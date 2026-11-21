import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryDirectory, installMemoryObserver } from "../../../test/setup/memory-directory";
import { OBSERVER_DEBOUNCE_MS, POLL_INTERVAL_MS, createChangeSource, type ChangeSource } from "./change-source";
import { createDirectoryAdapter } from "./directory-adapter";

function setup(options: { observer?: boolean; visible?: { value: boolean } } = {}) {
    const dir = createMemoryDirectory();
    const adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
    const changes = { count: 0, slow: [] as boolean[] };
    const uninstall = options.observer ? installMemoryObserver(dir) : () => undefined;
    const source = createChangeSource({
        adapter,
        folders: ["cvs", "letters"],
        root: dir.root as unknown as FileSystemDirectoryHandle,
        onPossibleChange: () => { changes.count += 1; },
        onSlowChange: (slow) => changes.slow.push(slow),
        createObserver: options.observer ? undefined : null,
        isVisible: () => options.visible?.value ?? true,
    });
    return { dir, source, changes, uninstall };
}

describe("change source", () => {
    let current: ChangeSource | null = null;
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
        current?.stop();
        vi.useRealTimers();
    });

    it("polls names and timestamps and reports a change once", async () => {
        const { dir, source, changes } = setup();
        current = source;
        await dir.writeExternal("cvs/a.cv.json", "1");
        await source.start();
        expect(source.kind).toBe("poll");
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 50);
        expect(changes.count).toBe(0);

        await dir.writeExternal("cvs/a.cv.json", "2");
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 50);
        expect(changes.count).toBe(1);

        await dir.writeExternal("letters/new.letter.json", "x");
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 50);
        expect(changes.count).toBe(2);

        await dir.removeExternal("letters/new.letter.json");
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS + 50);
        expect(changes.count).toBe(3);
    });

    it("does not poll while the tab is hidden and rescans when it returns", async () => {
        const visible = { value: true };
        const { dir, source, changes } = setup({ visible });
        current = source;
        await dir.writeExternal("cvs/a.cv.json", "1");
        await source.start();
        visible.value = false;
        source.onVisibilityChange();
        await dir.writeExternal("cvs/a.cv.json", "2");
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 4);
        expect(changes.count).toBe(0);

        visible.value = true;
        source.onVisibilityChange();
        await vi.advanceTimersByTimeAsync(50);
        expect(changes.count).toBe(1);
    });

    it("uses the observer when it works on the folder, debounced", async () => {
        const { dir, source, changes, uninstall } = setup({ observer: true });
        current = source;
        await source.start();
        expect(source.kind).toBe("observer");
        await dir.writeExternal("cvs/a.cv.json", "1");
        await dir.writeExternal("cvs/a.cv.json", "2");
        await dir.writeExternal("cvs/b.cv.json", "3");
        await vi.advanceTimersByTimeAsync(OBSERVER_DEBOUNCE_MS + 20);
        expect(changes.count).toBe(1);
        uninstall();
    });

    it("falls back to polling when the observer cannot be attached", async () => {
        const dir = createMemoryDirectory();
        const adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
        const source = createChangeSource({
            adapter,
            folders: ["cvs"],
            root: dir.root as unknown as FileSystemDirectoryHandle,
            onPossibleChange: () => undefined,
            createObserver: () => ({ observe: () => { throw new Error("unsupported"); }, disconnect: () => undefined }),
        });
        current = source;
        await source.start();
        expect(source.kind).toBe("poll");
    });

    it("flags a slow folder after three slow scans in a row, and clears it", async () => {
        const dir = createMemoryDirectory();
        const adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
        let clock = 0;
        let step = 1000;
        const slow: boolean[] = [];
        const source = createChangeSource({
            adapter,
            folders: ["cvs"],
            onPossibleChange: () => undefined,
            onSlowChange: (value) => slow.push(value),
            now: () => { clock += step; return clock; },
        });
        current = source;
        await source.start();
        await vi.advanceTimersByTimeAsync(10_000);
        expect(source.slow).toBe(true);
        step = 1;
        await vi.advanceTimersByTimeAsync(30_000);
        expect(source.slow).toBe(false);
        expect(slow).toEqual([true, false]);
    });

    it("stops cleanly", async () => {
        const { dir, source, changes } = setup();
        await dir.writeExternal("cvs/a.cv.json", "1");
        await source.start();
        source.stop();
        await dir.writeExternal("cvs/a.cv.json", "2");
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
        expect(changes.count).toBe(0);
    });
});
