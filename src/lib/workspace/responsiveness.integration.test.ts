import { describe, expect, it } from "vitest";
import { createCvCodec } from "./codecs/cv";
import { createDirectoryAdapter } from "./directory-adapter";
import { readFolderSnapshot, type IdCache } from "./documents";
import { mapInSlices } from "./batch";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { cvFileText, makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";

// Constitution IV: a folder of a hundred documents must not hold the main thread. A "long task" is 50 ms.
// These measure real time (not a fake clock) for the synchronous pieces and for the sliced loop, with a
// ceiling that leaves room for a slow CI machine.

const LONG_TASK_MS = 50;
const COUNT = 100;

const codec = createCvCodec();
const texts = Array.from({ length: COUNT }, (_, index) => cvFileText(makeWorkspaceCv({ id: `cv-${index}`, title: `CV ${index}`, name: `Person ${index}` })));

describe("a hundred documents stay responsive", () => {
    it("parses every file in slices, and no synchronous slice is a long task", async () => {
        const slices: number[] = [];
        let sliceStart = performance.now();
        const parsed = await mapInSlices(
            texts,
            (text) => codec.parse(text, { now: 0, hideContact: false }),
            {
                yieldToBrowser: async () => {
                    slices.push(performance.now() - sliceStart);
                    await new Promise((resolve) => setTimeout(resolve, 0));
                    sliceStart = performance.now();
                },
            },
        );
        slices.push(performance.now() - sliceStart);
        expect(parsed.every((result) => result.ok)).toBe(true);
        expect(Math.max(...slices)).toBeLessThan(LONG_TASK_MS);
    });

    it("no single parse is a long task by itself, so a slice can always end between files", () => {
        const times = texts.map((text) => {
            const start = performance.now();
            codec.parse(text, { now: 0, hideContact: false });
            return performance.now() - start;
        });
        expect(Math.max(...times)).toBeLessThan(LONG_TASK_MS);
    });

    it("scans a folder of a hundred files, and a second scan with no changes reads none of them", async () => {
        const folder = createMemoryDirectory("applications");
        for (let index = 0; index < COUNT; index += 1) await folder.writeExternal(`cvs/CV ${index}.cv.json`, texts[index]);
        const adapter = createDirectoryAdapter(folder.root as unknown as FileSystemDirectoryHandle);
        const cache: IdCache = new Map();

        const first = await readFolderSnapshot(adapter, cache);
        expect(first.files).toHaveLength(COUNT);
        expect(first.files.every((file) => file.valid && file.id)).toBe(true);

        let reads = 0;
        const counting = { ...adapter, readText: async (...args: Parameters<typeof adapter.readText>) => { reads += 1; return adapter.readText(...args); } };
        const started = performance.now();
        await readFolderSnapshot(counting, cache);
        expect(reads).toBe(0);
        // Listing a hundred files and comparing stamps is cheap; a rescan every couple of seconds must not add up to jank.
        expect(performance.now() - started).toBeLessThan(LONG_TASK_MS * 4);
    });
});
