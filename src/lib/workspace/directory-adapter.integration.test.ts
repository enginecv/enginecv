import { describe, expect, it } from "vitest";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { createDirectoryAdapter } from "./directory-adapter";

const adapterFor = (dir = createMemoryDirectory()) => ({ dir, adapter: createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle) });

describe("directory adapter", () => {
    it("writes files, creating folders, and reads them back", async () => {
        const { adapter, dir } = adapterFor();
        await adapter.writeText("cvs", "a.cv.json", "{}\n");
        expect(await adapter.readText("cvs", "a.cv.json")).toBe("{}\n");
        expect(await adapter.readText("cvs", "missing.cv.json")).toBeNull();
        expect(await adapter.readText("nope", "a.json")).toBeNull();
        expect(await dir.listExternal("")).toEqual(["cvs"]);
    });

    it("lists files with size and time, and folders, and treats a missing folder as empty", async () => {
        const { adapter, dir } = adapterFor();
        await dir.writeExternal("cvs/a.cv.json", "12345");
        await dir.writeExternal("cvs/sub/x.json", "x");
        const files = await adapter.listFiles("cvs");
        expect(files).toHaveLength(1);
        expect(files[0]).toMatchObject({ name: "a.cv.json", size: 5 });
        expect(files[0].lastModified).toBeGreaterThan(0);
        expect(await adapter.listFolders("cvs")).toEqual(["sub"]);
        expect(await adapter.listFiles("letters")).toEqual([]);
    });

    it("lists the swap file while a write is open, which the scanner will ignore", async () => {
        const { adapter, dir } = adapterFor();
        await adapter.writeText("cvs", "a.cv.json", "OLD");
        const file = await adapter.fileAdapter("cvs", "a.cv.json");
        // An external writer is mid-write.
        const handle = await dir.root.getDirectoryHandle("cvs").then((cvs) => cvs.getFileHandle("a.cv.json"));
        const writable = await handle.createWritable();
        await writable.write("NEW");
        expect((await adapter.listFiles("cvs")).map((entry) => entry.name).sort()).toEqual(["a.cv.json", "a.cv.json.crswap"]);
        expect(await file.readText()).toBe("OLD");
        await writable.close();
        expect(await file.readText()).toBe("NEW");
    });

    it("hands out a file adapter that reads, writes and stats one document", async () => {
        const { adapter } = adapterFor();
        const file = await adapter.fileAdapter("cvs", "a.cv.json", { create: true });
        await file.writeText("hello");
        expect(await file.readText()).toBe("hello");
        expect((await file.stat()).size).toBe(5);
        await expect(adapter.fileAdapter("cvs", "other.cv.json")).rejects.toMatchObject({ code: "not-found" });
    });

    it("removes files and says whether they exist", async () => {
        const { adapter } = adapterFor();
        await adapter.writeText("", "x.json", "1");
        expect(await adapter.exists("", "x.json")).toBe(true);
        await adapter.remove("", "x.json");
        expect(await adapter.exists("", "x.json")).toBe(false);
        await adapter.remove("", "x.json");
    });

    it("reports and requests permission", async () => {
        const { adapter, dir } = adapterFor();
        expect(await adapter.permissionState()).toBe("granted");
        dir.setPermission("prompt", "granted");
        expect(await adapter.permissionState()).toBe("prompt");
        expect(await adapter.ensurePermission(false)).toBe(false);
        expect(await adapter.ensurePermission(true)).toBe(true);
        dir.setPermission("prompt", "denied");
        expect(await adapter.ensurePermission(true)).toBe(false);
    });

    it("maps a stale handle to not-found", async () => {
        const { adapter, dir } = adapterFor();
        const file = await adapter.fileAdapter("cvs", "a.cv.json", { create: true });
        await dir.removeExternal("cvs/a.cv.json");
        await expect(file.readText()).rejects.toMatchObject({ code: "not-found" });
    });
});
