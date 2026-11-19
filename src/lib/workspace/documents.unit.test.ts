import { describe, expect, it } from "vitest";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { cvFileText, makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";
import { createDirectoryAdapter } from "./directory-adapter";
import { reconcile, readFolderSnapshot, type FolderSnapshot } from "./documents";
import { newDocRow } from "./workspace-store";

const row = (docId: string, fileName: string | null, over: Partial<ReturnType<typeof newDocRow>> = {}) => newDocRow({ docId, kind: "cv", fileName, ...over }, 1);
const file = (name: string, id: string | null, valid = true) => ({ kind: "cv" as const, name, id, valid });
const snapshot = (files: ReturnType<typeof file>[]): FolderSnapshot => ({ files, conflictCopies: [], skipped: [] });

describe("reconcile", () => {
    it("matches a document to its own file", () => {
        const result = reconcile([row("1", "a.cv.json")], snapshot([file("a.cv.json", "1")]));
        expect(result).toEqual({ renames: [], detached: [], duplicates: [], unmatched: [] });
    });

    it("follows a rename by the id inside the file", () => {
        const result = reconcile([row("1", "a.cv.json")], snapshot([file("renamed.cv.json", "1")]));
        expect(result.renames).toEqual([{ docId: "1", kind: "cv", from: "a.cv.json", to: "renamed.cv.json" }]);
        expect(result.detached).toEqual([]);
        expect(result.unmatched).toEqual([]);
    });

    it("detaches a document whose file is gone and has no twin", () => {
        const result = reconcile([row("1", "a.cv.json")], snapshot([]));
        expect(result.detached).toEqual(["1"]);
    });

    it("flags two files claiming one document and applies neither", () => {
        const both = reconcile([row("1", "a.cv.json")], snapshot([file("a.cv.json", "1"), file("copy.cv.json", "1")]));
        expect(both.duplicates).toEqual([{ docId: "1", kind: "cv", files: ["a.cv.json", "copy.cv.json"] }]);
        const gone = reconcile([row("1", "a.cv.json")], snapshot([file("x.cv.json", "1"), file("y.cv.json", "1")]));
        expect(gone.duplicates[0].files.sort()).toEqual(["x.cv.json", "y.cv.json"]);
        expect(gone.renames).toEqual([]);
    });

    it("lists files nobody claims, with their id", () => {
        const result = reconcile([row("1", "a.cv.json")], snapshot([file("a.cv.json", "1"), file("stranger.cv.json", "zzz"), file("noid.cv.json", null)]));
        expect(result.unmatched).toEqual([{ kind: "cv", fileName: "stranger.cv.json", id: "zzz", valid: true }, { kind: "cv", fileName: "noid.cv.json", id: null, valid: true }]);
    });

    it("treats a file without an id at the expected name as the document's own", () => {
        expect(reconcile([row("1", "a.cv.json")], snapshot([file("A.cv.json", null)])).detached).toEqual([]);
    });

    it("ignores excluded documents and documents with no file yet", () => {
        const result = reconcile([row("1", "a.cv.json", { included: false }), row("2", null)], snapshot([]));
        expect(result.detached).toEqual([]);
    });

    it("does not detach a document whose file is too large to read", () => {
        const result = reconcile([row("1", "a.cv.json")], { files: [], conflictCopies: [], skipped: [], tooLarge: ["A.cv.json"] });
        expect(result.detached).toEqual([]);
    });

    it("a file whose id belongs to another document does not count as the row's file", () => {
        const result = reconcile([row("1", "a.cv.json"), row("2", "b.cv.json")], snapshot([file("a.cv.json", "2"), file("b.cv.json", "2")]));
        expect(result.detached).toContain("1");
    });
});

describe("readFolderSnapshot", () => {
    it("reads a file's id once and again only when its stamp changes", async () => {
        const dir = createMemoryDirectory();
        const adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
        await dir.writeExternal("cvs/a.cv.json", cvFileText(makeWorkspaceCv({ id: "cv-1" })));
        const cache = new Map();
        const first = await readFolderSnapshot(adapter, cache);
        expect(first.files).toEqual([{ kind: "cv", name: "a.cv.json", id: "cv-1", valid: true }]);

        // Corrupt the cache entry: an unchanged stamp must not re-read.
        const key = [...cache.keys()][0];
        cache.set(key, { ...cache.get(key), id: "from-cache" });
        expect((await readFolderSnapshot(adapter, cache)).files[0].id).toBe("from-cache");

        await dir.writeExternal("cvs/a.cv.json", cvFileText(makeWorkspaceCv({ id: "cv-9" })));
        expect((await readFolderSnapshot(adapter, cache)).files[0].id).toBe("cv-9");
    });

    it("leaves out swap files, conflict copies and ignored names, but reports the copies", async () => {
        const dir = createMemoryDirectory();
        const adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
        const text = cvFileText(makeWorkspaceCv({ id: "cv-1" }));
        await dir.writeExternal("cvs/a.cv.json", text);
        await dir.writeExternal("cvs/a.cv.json.crswap", "half");
        await dir.writeExternal("cvs/a (conflicted copy 2026).cv.json", text);
        await dir.writeExternal("cvs/skipme.cv.json", text);
        const snap = await readFolderSnapshot(adapter, new Map(), new Set(["skipme.cv.json"]));
        expect(snap.files.map((entry) => entry.name)).toEqual(["a.cv.json"]);
        expect(snap.conflictCopies.map((copy) => copy.fileName)).toEqual(["a (conflicted copy 2026).cv.json"]);
    });
});

describe("reconcile: documents left out of the workspace", () => {
    it("still claims their file, so it is neither a stray nor a new document", () => {
        const result = reconcile([row("1", "a.cv.json", { included: false })], snapshot([file("a.cv.json", "1"), file("renamed.cv.json", "1")]));
        expect(result.unmatched).toEqual([]);
        expect(result.detached).toEqual([]);
    });
});
