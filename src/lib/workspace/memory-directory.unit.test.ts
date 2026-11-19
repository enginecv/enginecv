import { describe, expect, it, vi } from "vitest";
import { createMemoryDirectory, installMemoryObserver } from "../../../test/setup/memory-directory";

const text = async (dir: ReturnType<typeof createMemoryDirectory>, name: string) => (await (await dir.root.getFileHandle(name)).getFile()).text();

async function write(dir: ReturnType<typeof createMemoryDirectory>, name: string, body: string) {
    const handle = await dir.root.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    await writable.write(body);
    await writable.close();
    return handle;
}

describe("memory directory fake", () => {
    it("shows the old content until a writable closes, and lists the swap file meanwhile", async () => {
        const dir = createMemoryDirectory();
        const handle = await write(dir, "a.json", "OLD");
        const writable = await handle.createWritable();
        await writable.write("NEW");
        expect(await text(dir, "a.json")).toBe("OLD");
        expect(await dir.listExternal()).toEqual(["a.json", "a.json.crswap"]);
        await writable.close();
        expect(await text(dir, "a.json")).toBe("NEW");
        expect(await dir.listExternal()).toEqual(["a.json"]);
    });

    it("keeps the old content when a write is aborted", async () => {
        const dir = createMemoryDirectory();
        const handle = await write(dir, "a.json", "OLD");
        const writable = await handle.createWritable();
        await writable.write("HALF");
        await writable.abort();
        expect(await text(dir, "a.json")).toBe("OLD");
    });

    it("lets the last closed writable win", async () => {
        const dir = createMemoryDirectory();
        const handle = await write(dir, "a.json", "OLD");
        const first = await handle.createWritable();
        const second = await handle.createWritable();
        await first.write("FIRST");
        await second.write("SECOND");
        await first.close();
        await second.close();
        expect(await text(dir, "a.json")).toBe("SECOND");
    });

    it("advances lastModified on every close and external write", async () => {
        const dir = createMemoryDirectory("w", { now: () => 1000 });
        const handle = await write(dir, "a.json", "1");
        const first = (await handle.getFile()).lastModified;
        await write(dir, "a.json", "2");
        const second = (await handle.getFile()).lastModified;
        await dir.writeExternal("a.json", "3");
        const third = (await handle.getFile()).lastModified;
        expect(second).toBeGreaterThan(first);
        expect(third).toBeGreaterThan(second);
    });

    it("replaces a file silently when moving onto an existing name", async () => {
        const dir = createMemoryDirectory();
        const one = await write(dir, "one.json", "1");
        await write(dir, "two.json", "2");
        await one.move("two.json");
        expect(await dir.listExternal()).toEqual(["two.json"]);
        expect(await text(dir, "two.json")).toBe("1");
    });

    it("throws NotFoundError for a handle whose file was removed", async () => {
        const dir = createMemoryDirectory();
        const handle = await write(dir, "gone.json", "x");
        await dir.root.removeEntry("gone.json");
        await expect(handle.getFile()).rejects.toMatchObject({ name: "NotFoundError" });
    });

    it("is case sensitive by default and folds case in Windows mode", async () => {
        const sensitive = createMemoryDirectory();
        await write(sensitive, "UPPER.json", "1");
        await write(sensitive, "upper.json", "2");
        expect(await sensitive.listExternal()).toEqual(["UPPER.json", "upper.json"]);

        const windows = createMemoryDirectory("w", { caseInsensitive: true, refuseReservedNames: true });
        await write(windows, "UPPER.json", "1");
        await write(windows, "upper.json", "2");
        expect(await windows.listExternal()).toEqual(["UPPER.json"]);
        await expect(windows.root.getFileHandle("con.json", { create: true })).rejects.toMatchObject({ name: "InvalidModificationError" });
        await expect(windows.root.getFileHandle("name.", { create: true })).rejects.toMatchObject({ name: "InvalidModificationError" });
        await expect(windows.root.getFileHandle("a/b.json", { create: true })).rejects.toBeInstanceOf(TypeError);
    });

    it("fails the next write when told to (a busy file), then recovers", async () => {
        const dir = createMemoryDirectory();
        const handle = await write(dir, "a.json", "OLD");
        dir.failNext("a.json", "write", "NoModificationAllowedError", 1);
        await expect(handle.createWritable()).rejects.toMatchObject({ name: "NoModificationAllowedError" });
        const writable = await handle.createWritable();
        await writable.write("OK");
        await writable.close();
        expect(await text(dir, "a.json")).toBe("OK");
    });

    it("reports and changes permission", async () => {
        const dir = createMemoryDirectory();
        dir.setPermission("prompt", "granted");
        expect(await dir.root.queryPermission()).toBe("prompt");
        expect(await dir.root.requestPermission()).toBe("granted");
        dir.setPermission("prompt", "denied");
        expect(await dir.root.requestPermission()).toBe("denied");
    });

    it("walks subfolders and reports changes to an observer", async () => {
        const dir = createMemoryDirectory();
        const seen: string[] = [];
        const uninstall = installMemoryObserver(dir);
        const Observer = (globalThis as unknown as { FileSystemObserver: new (cb: (records: Array<{ type: string; relativePathComponents: string[] }>) => void) => { observe(handle: unknown): Promise<void>; disconnect(): void } }).FileSystemObserver;
        const observer = new Observer((records) => records.forEach((record) => seen.push(`${record.type}:${record.relativePathComponents.join("/")}`)));
        await observer.observe(dir.root);
        await dir.writeExternal("cvs/a.cv.json", "1");
        await dir.writeExternal("cvs/a.cv.json", "2");
        await dir.removeExternal("cvs/a.cv.json");
        observer.disconnect();
        await dir.writeExternal("cvs/after.json", "3");
        uninstall();
        expect(seen).toEqual(["appeared:cvs", "appeared:cvs/a.cv.json", "modified:cvs/a.cv.json", "modified:cvs/a.cv.json", "disappeared:cvs/a.cv.json"]);
        expect(await dir.readExternal("cvs/after.json")).toBe("3");
        expect(vi.isMockFunction(Observer)).toBe(false);
    });
});
