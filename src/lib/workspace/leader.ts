/**
 * One tab at a time runs the workspace (scans, writes, answers requests); the others only show state.
 * The browser's Web Locks queue elects the leader: the lock is held for as long as the tab lives, and
 * when it closes the next waiting tab is granted it and takes over. Without Web Locks a heartbeat in
 * localStorage does the same job more loosely. A BroadcastChannel carries "documents changed" nudges
 * so followers refresh at once.
 */

export interface LockManagerLike {
    request(
        name: string,
        options: { mode?: "exclusive" | "shared"; signal?: AbortSignal },
        callback: () => Promise<unknown>,
    ): Promise<unknown>;
}

export interface LeaderStorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

export interface BroadcastLike {
    postMessage(message: unknown): void;
    onmessage: ((event: { data: unknown }) => void) | null;
    close(): void;
}

export interface LeaderOptions {
    name?: string;
    locks?: LockManagerLike | null;
    storage?: LeaderStorageLike | null;
    channel?: BroadcastLike | null;
    /** Heartbeat fallback timings. */
    heartbeatMs?: number;
    staleMs?: number;
    now?: () => number;
    id?: string;
}

export interface Leader {
    start(): void;
    stop(): void;
    readonly isLeader: boolean;
    /** Called with true when this tab becomes the leader, false when it stops being one. */
    onChange(listener: (leader: boolean) => void): () => void;
    /** Tell the other tabs something changed. */
    nudge(): void;
    onNudge(listener: () => void): () => void;
}

const NUDGE = "enginecv-workspace-nudge";

export function createLeader(options: LeaderOptions = {}): Leader {
    const name = options.name ?? "enginecv-workspace";
    const locks = options.locks === undefined ? (typeof navigator !== "undefined" ? ((navigator as unknown as { locks?: LockManagerLike }).locks ?? null) : null) : options.locks;
    const storage = options.storage === undefined ? (typeof localStorage !== "undefined" ? localStorage : null) : options.storage;
    const channel = options.channel === undefined ? (typeof BroadcastChannel !== "undefined" ? (new BroadcastChannel(name) as unknown as BroadcastLike) : null) : options.channel;
    const now = options.now ?? (() => Date.now());
    const heartbeatMs = options.heartbeatMs ?? 2000;
    const staleMs = options.staleMs ?? 6000;
    const id = options.id ?? `${now()}-${Math.random().toString(36).slice(2)}`;

    let leader = false;
    let running = false;
    let release: (() => void) | null = null;
    let abort: AbortController | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    const changeListeners = new Set<(value: boolean) => void>();
    const nudgeListeners = new Set<() => void>();

    const setLeader = (value: boolean) => {
        if (leader === value) return;
        leader = value;
        for (const listener of changeListeners) listener(value);
    };

    if (channel) {
        channel.onmessage = (event) => {
            if (event.data === NUDGE) for (const listener of nudgeListeners) listener();
        };
    }

    function startWithLocks(manager: LockManagerLike) {
        abort = new AbortController();
        void manager
            .request(name, { mode: "exclusive", signal: abort.signal }, async () => {
                if (!running) return;
                setLeader(true);
                await new Promise<void>((resolve) => {
                    release = resolve;
                });
                setLeader(false);
            })
            .catch(() => {
                // Aborted while waiting: this tab never became the leader.
            });
    }

    function heartbeat(store: LeaderStorageLike) {
        const key = `${name}:leader`;
        const tick = () => {
            const raw = store.getItem(key);
            let holder: { id: string; at: number } | null = null;
            try {
                holder = raw ? (JSON.parse(raw) as { id: string; at: number }) : null;
            } catch {
                holder = null;
            }
            const stale = !holder || now() - holder.at > staleMs;
            if (stale || holder?.id === id) {
                store.setItem(key, JSON.stringify({ id, at: now() }));
                setLeader(true);
            } else {
                setLeader(false);
            }
        };
        tick();
        timer = setInterval(tick, heartbeatMs);
    }

    return {
        start() {
            if (running) return;
            running = true;
            if (locks) startWithLocks(locks);
            else if (storage) heartbeat(storage);
            else setLeader(true); // nothing to coordinate with: a lone tab leads
        },
        stop() {
            running = false;
            abort?.abort();
            release?.();
            release = null;
            if (timer) clearInterval(timer);
            timer = null;
            if (!locks && storage) {
                const key = `${name}:leader`;
                try {
                    const holder = JSON.parse(storage.getItem(key) ?? "null") as { id: string } | null;
                    if (holder?.id === id) storage.removeItem(key);
                } catch {
                    /* ignore */
                }
            }
            setLeader(false);
            if (channel) {
                channel.onmessage = null;
                channel.close();
            }
        },
        get isLeader() {
            return leader;
        },
        onChange(listener) {
            changeListeners.add(listener);
            return () => changeListeners.delete(listener);
        },
        nudge() {
            channel?.postMessage(NUDGE);
        },
        onNudge(listener) {
            nudgeListeners.add(listener);
            return () => nudgeListeners.delete(listener);
        },
    };
}
