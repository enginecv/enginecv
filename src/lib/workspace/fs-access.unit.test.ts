import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeDisk, FakeDomError, asHandle } from "../../../test/setup/fake-file-handle";
import {
    FileAccessError,
    createHandleAdapter,
    mapFileError,
} from "./fs-access";

describe("mapFileError", () => {
    it.each([
        ["NotFoundError", "not-found"],
        ["NotAllowedError", "permission"],
        ["SecurityError", "permission"],
        ["NoModificationAllowedError", "busy"],
        ["InvalidStateError", "busy"],
        ["Whatever", "unknown"],
    ])("%s -> %s", (name, code) => {
        expect(mapFileError(new FakeDomError(name)).code).toBe(code);
    });
});

describe("adapter", () => {
    it("reads, stats and writes through the handle", async () => {
        const disk = new FakeDisk();
        const handle = disk.create("a.enginecv.json", "hello");
        const adapter = createHandleAdapter(asHandle(handle));
        expect(adapter.name).toBe("a.enginecv.json");
        expect(await adapter.readText()).toBe("hello");
        const before = await adapter.stat();
        await adapter.writeText("bye!");
        expect(disk.read("a.enginecv.json")).toBe("bye!");
        const after = await adapter.stat();
        expect(after.lastModified).toBeGreaterThan(before.lastModified);
        expect(after.size).toBe(4);
    });

    it("maps a vanished file to not-found and a lock to busy", async () => {
        const disk = new FakeDisk();
        const handle = disk.create("a.json", "x");
        const adapter = createHandleAdapter(asHandle(handle));
        handle.locked = true;
        await expect(adapter.writeText("y")).rejects.toMatchObject({ code: "busy" });
        handle.locked = false;
        disk.externalDelete("a.json");
        await expect(adapter.stat()).rejects.toMatchObject({ code: "not-found" });
    });

    it("renames in place and refuses a collision", async () => {
        const disk = new FakeDisk();
        const handle = disk.create("a.json", "x");
        disk.create("b.json", "y");
        const adapter = createHandleAdapter(asHandle(handle));
        await expect(adapter.rename("b.json")).rejects.toBeInstanceOf(FileAccessError);
        await adapter.rename("c.json");
        expect(adapter.name).toBe("c.json");
    });

    it("reports unsupported rename", async () => {
        const adapter = createHandleAdapter({ name: "x" } as unknown as FileSystemFileHandle);
        await expect(adapter.rename("y")).rejects.toMatchObject({ code: "unknown" });
    });

    it("checks and requests permission", async () => {
        const disk = new FakeDisk();
        const handle = disk.create("a.json", "x");
        handle.permission = "prompt";
        const adapter = createHandleAdapter(asHandle(handle));
        expect(await adapter.ensurePermission(false)).toBe(false);
        expect(await adapter.ensurePermission(true)).toBe(true);
        handle.permission = "denied";
        expect(await adapter.ensurePermission(true)).toBe(false);
    });
});
