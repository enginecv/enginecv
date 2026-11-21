import type { DirectoryAdapter } from "./directory-adapter";
import type { ChangeSourceKind } from "./types";

/**
 * Tells the controller "something in the watched folders may have changed". Two ways, one stream:
 * the browser's `FileSystemObserver` when it works on this folder, otherwise polling file names and
 * timestamps. Either way the engine's content hash decides whether a change is real, so a false
 * alarm only costs a read. Polling pauses while the tab is hidden and rescans when it returns.
 */

export const OBSERVER_DEBOUNCE_MS = 150;
export const POLL_INTERVAL_MS = 1500;
export const IDLE_POLL_INTERVAL_MS = 2000;
const IDLE_AFTER_MS = 60_000;
/**
 * With the observer attached, a safety scan still runs in case it misses something. The observer can attach
 * without ever firing for folders it does not really support, so this stays short (a listing is cheap).
 */
export const SAFETY_SCAN_MS = 3_000;
export const SLOW_SCAN_MS = 750;
const SLOW_SCANS_IN_A_ROW = 3;
const SLOW_INTERVAL_MS = 5000;

interface ObserverLike {
    observe(handle: FileSystemHandle, options?: { recursive?: boolean }): Promise<void> | void;
    disconnect(): void;
}
type ObserverFactory = (callback: (records: unknown[]) => void) => ObserverLike;

export interface ChangeSourceOptions {
    adapter: DirectoryAdapter;
    /** Folders under the root to watch for file changes. */
    folders: readonly string[];
    onPossibleChange: () => void;
    /** Tell the UI the folder is slow to scan. */
    onSlowChange?: (slow: boolean) => void;
    /** The root handle, needed to attach the browser's observer. */
    root?: FileSystemDirectoryHandle;
    /** Defaults to the global `FileSystemObserver` when present. */
    createObserver?: ObserverFactory | null;
    isVisible?: () => boolean;
    now?: () => number;
}

export interface ChangeSource {
    readonly kind: ChangeSourceKind;
    readonly slow: boolean;
    start(): Promise<void>;
    stop(): void;
    /** A scan now (tab focus, "Check now"). */
    nudge(): void;
    onVisibilityChange(): void;
}

function defaultObserverFactory(): ObserverFactory | null {
    const Observer = (globalThis as unknown as { FileSystemObserver?: new (cb: (records: unknown[]) => void) => ObserverLike }).FileSystemObserver;
    return Observer ? (callback) => new Observer(callback) : null;
}

export function createChangeSource(options: ChangeSourceOptions): ChangeSource {
    const now = options.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
    const visible = options.isVisible ?? (() => typeof document === "undefined" || document.visibilityState === "visible");
    const factory = options.createObserver === undefined ? defaultObserverFactory() : options.createObserver;

    let kind: ChangeSourceKind = "poll";
    let running = false;
    let slow = false;
    let slowStreak = 0;
    let observer: ObserverLike | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let signature: string | null = null;
    let quietSince = now();
    let scanning = false;

    const fire = () => {
        quietSince = now();
        options.onPossibleChange();
    };

    async function scan(): Promise<boolean> {
        if (scanning) return false;
        scanning = true;
        const started = now();
        try {
            const parts: string[] = [];
            for (const folder of options.folders) {
                const files = await options.adapter.listFiles(folder);
                for (const file of files) parts.push(`${folder}/${file.name}:${file.lastModified}:${file.size}`);
            }
            parts.sort();
            const next = parts.join("\n");
            const changed = signature !== null && next !== signature;
            const first = signature === null;
            signature = next;
            return changed || first;
        } finally {
            scanning = false;
            const took = now() - started;
            slowStreak = took > SLOW_SCAN_MS ? slowStreak + 1 : 0;
            const nowSlow = slowStreak >= SLOW_SCANS_IN_A_ROW;
            if (nowSlow !== slow) {
                slow = nowSlow;
                options.onSlowChange?.(slow);
            }
        }
    }

    function interval(): number {
        if (kind === "observer") return SAFETY_SCAN_MS;
        if (slow) return SLOW_INTERVAL_MS;
        return now() - quietSince > IDLE_AFTER_MS ? IDLE_POLL_INTERVAL_MS : POLL_INTERVAL_MS;
    }

    function schedule() {
        if (pollTimer) clearTimeout(pollTimer);
        pollTimer = null;
        if (!running || !visible()) return;
        pollTimer = setTimeout(async () => {
            pollTimer = null;
            try {
                if (await scan()) fire();
            } catch {
                // A folder that cannot be read is the controller's business (permission, missing); keep going.
                fire();
            }
            schedule();
        }, interval());
    }

    function attachObserver(): boolean {
        if (!factory || !options.root) return false;
        try {
            const created = factory(() => {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    debounceTimer = null;
                    if (running) fire();
                }, OBSERVER_DEBOUNCE_MS);
            });
            const attached = created.observe(options.root, { recursive: true });
            // Some builds reject for handles the observer does not support; treat any failure as "not available".
            if (attached && typeof (attached as Promise<void>).then === "function") {
                (attached as Promise<void>).catch(() => {
                    if (!running || observer !== created) return;
                    created.disconnect();
                    observer = null;
                    kind = "poll";
                    schedule();
                });
            }
            observer = created;
            return true;
        } catch {
            return false;
        }
    }

    return {
        get kind() {
            return kind;
        },
        get slow() {
            return slow;
        },
        async start() {
            running = true;
            quietSince = now();
            kind = attachObserver() ? "observer" : "poll";
            // The first scan records a baseline, so the next real change is noticed.
            try {
                await scan();
            } catch {
                /* the controller reports unreadable folders */
            }
            schedule();
        },
        stop() {
            running = false;
            if (pollTimer) clearTimeout(pollTimer);
            if (debounceTimer) clearTimeout(debounceTimer);
            pollTimer = debounceTimer = null;
            observer?.disconnect();
            observer = null;
        },
        nudge() {
            if (!running) return;
            quietSince = now();
            void scan().then((changed) => changed && fire()).catch(() => fire()).finally(schedule);
        },
        onVisibilityChange() {
            if (!running) return;
            if (!visible()) {
                if (pollTimer) clearTimeout(pollTimer);
                pollTimer = null;
                return;
            }
            this.nudge();
        },
    };
}
