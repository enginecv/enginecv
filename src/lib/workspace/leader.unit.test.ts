import { afterEach, describe, expect, it, vi } from "vitest";
import { createLeader, type BroadcastLike, type LeaderStorageLike, type LockManagerLike } from "./leader";

/** A tiny Web Locks queue: exclusive requests are granted one at a time, in order. */
function fakeLocks(): LockManagerLike {
    const queue: Array<{ run: () => Promise<unknown>; resolve: (value: unknown) => void; reject: (reason: unknown) => void; signal?: AbortSignal; granted: boolean }> = [];
    let held = false;
    const pump = () => {
        if (held) return;
        const next = queue.find((entry) => !entry.granted && !entry.signal?.aborted);
        if (!next) return;
        next.granted = true;
        held = true;
        void next.run().then(next.resolve, next.reject).finally(() => {
            held = false;
            queue.splice(queue.indexOf(next), 1);
            pump();
        });
    };
    return {
        request(_name, options, callback) {
            return new Promise((resolve, reject) => {
                const entry = { run: callback, resolve, reject, signal: options.signal, granted: false };
                options.signal?.addEventListener("abort", () => {
                    if (!entry.granted) {
                        queue.splice(queue.indexOf(entry), 1);
                        reject(new DOMException("aborted", "AbortError"));
                    }
                });
                queue.push(entry);
                pump();
            });
        },
    };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("leader election with Web Locks", () => {
    it("lets one tab lead and hands over when it closes", async () => {
        const locks = fakeLocks();
        const a = createLeader({ locks, storage: null, channel: null });
        const b = createLeader({ locks, storage: null, channel: null });
        const changes: string[] = [];
        a.onChange((value) => changes.push(`a:${value}`));
        b.onChange((value) => changes.push(`b:${value}`));
        a.start();
        await flush();
        b.start();
        await flush();
        expect(a.isLeader).toBe(true);
        expect(b.isLeader).toBe(false);

        a.stop();
        await flush();
        expect(a.isLeader).toBe(false);
        expect(b.isLeader).toBe(true);
        expect(changes).toEqual(["a:true", "a:false", "b:true"]);
        b.stop();
    });

    it("a tab stopped while waiting never becomes the leader", async () => {
        const locks = fakeLocks();
        const a = createLeader({ locks, storage: null, channel: null });
        const b = createLeader({ locks, storage: null, channel: null });
        a.start();
        await flush();
        b.start();
        b.stop();
        a.stop();
        await flush();
        expect(b.isLeader).toBe(false);
    });

    it("carries nudges between tabs", async () => {
        const listeners = new Set<BroadcastLike>();
        const channel = (): BroadcastLike => {
            const handle: BroadcastLike = {
                onmessage: null,
                postMessage: (message) => listeners.forEach((other) => other !== handle && other.onmessage?.({ data: message })),
                close: () => listeners.delete(handle),
            };
            listeners.add(handle);
            return handle;
        };
        const a = createLeader({ locks: null, storage: null, channel: channel() });
        const b = createLeader({ locks: null, storage: null, channel: channel() });
        let nudged = 0;
        b.onNudge(() => { nudged += 1; });
        a.nudge();
        expect(nudged).toBe(1);
    });

    it("a lone tab with nothing to coordinate with leads", () => {
        const leader = createLeader({ locks: null, storage: null, channel: null });
        leader.start();
        expect(leader.isLeader).toBe(true);
    });
});

describe("leader election by heartbeat (no Web Locks)", () => {
    afterEach(() => vi.useRealTimers());

    function memoryStorage(): LeaderStorageLike {
        const map = new Map<string, string>();
        return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value), removeItem: (key) => void map.delete(key) };
    }

    it("takes over when the leader closes", () => {
        vi.useFakeTimers();
        const storage = memoryStorage();
        const now = () => Date.now();
        const a = createLeader({ locks: null, storage, channel: null, now, id: "a" });
        const b = createLeader({ locks: null, storage, channel: null, now, id: "b" });
        a.start();
        b.start();
        expect(a.isLeader).toBe(true);
        expect(b.isLeader).toBe(false);

        a.stop();
        vi.advanceTimersByTime(2100);
        expect(b.isLeader).toBe(true);
        b.stop();
    });

    it("ignores a holder that stopped beating long ago", () => {
        const storage = memoryStorage();
        storage.setItem("enginecv-workspace:leader", JSON.stringify({ id: "crashed", at: 1000 }));
        const leader = createLeader({ locks: null, storage, channel: null, now: () => 20_000, id: "me" });
        leader.start();
        expect(leader.isLeader).toBe(true);
        leader.stop();
    });
});
