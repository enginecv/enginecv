import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetLetterTables } from "../../../test/setup/letter-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";

let current = createMemoryDirectory("applications");
vi.mock("./directory-adapter", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./directory-adapter")>();
    return { ...actual, isWorkspaceSupported: () => true, createDirectoryAdapter: () => actual.createDirectoryAdapter(current.root as unknown as FileSystemDirectoryHandle) };
});
vi.mock("./leader", () => ({
    createLeader: () => ({ start() {}, stop() {}, isLeader: true, onChange: (listener: (value: boolean) => void) => { listener(true); return () => undefined; }, nudge() {}, onNudge: () => () => undefined }),
}));

const STAND_IN = { kind: "directory", name: "applications" } as unknown as FileSystemDirectoryHandle;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect() {
    const controller = await import("./controller");
    const options = { hideContact: false, now: 1 };
    await controller.connectFolder({ handle: STAND_IN, analysis: await controller.analyzeFolderHandle(STAND_IN, options), options });
    return controller;
}

describe("workspace controller: permission and folder loss", () => {
    beforeEach(async () => {
        (await import("./controller")).resetWorkspaceController();
        current = createMemoryDirectory("applications");
        await resetLetterTables();
        await db.workspace.clear();
        await db.workspaceDocs.clear();
        await db.resumes.put(makeWorkspaceCv({ id: "cv-1", title: "Master CV" }));
    });
    afterEach(async () => {
        (await import("./controller")).resetWorkspaceController();
    });

    it("moves to needs-permission when the browser takes it back, keeps editing in the app, and one action restores it", async () => {
        const controller = await connect();
        current.setPermission("prompt", "granted");
        await controller.getRuntime()?.checkNow();
        await controller.verifyFolder();
        expect(controller.useWorkspaceStore.getState().phase).toBe("needs-permission");
        expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("needs-permission");

        // Editing is never blocked: the CV changes in the app as always.
        await db.resumes.update("cv-1", { basics: { ...(await db.resumes.get("cv-1"))!.basics, headline: "Edited without a folder" } });
        expect((await db.resumes.get("cv-1"))?.basics.headline).toBe("Edited without a folder");

        expect(await controller.resumePermission()).toBe(true);
        expect(controller.useWorkspaceStore.getState().phase).toBe("connected");
        await wait(1500);
        // The edit made meanwhile reaches the file once the folder is back.
        expect(JSON.parse((await current.readExternal("cvs/Master CV.cv.json"))!).basics.headline).toBe("Edited without a folder");
        expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("in-sync");
    }, 15_000);

    it("stays in needs-permission when the person declines, without losing anything", async () => {
        const controller = await connect();
        current.setPermission("prompt", "denied");
        await controller.verifyFolder();
        expect(await controller.resumePermission()).toBe(false);
        expect(controller.useWorkspaceStore.getState().phase).toBe("needs-permission");
        expect(await db.resumes.get("cv-1")).toBeDefined();
    });

    it("says the folder is missing when it is gone, and choosing a folder again reconnects in one action", async () => {
        const controller = await connect();
        current.setPermission("prompt", "granted"); // stand-in for a handle that no longer resolves
        const missing = Object.assign(new Error("gone"), { name: "NotFoundError" });
        const original = current.root.entries.bind(current.root);
        (current.root as unknown as { entries: () => never }).entries = () => { throw missing; };
        current.setPermission("granted");
        await controller.verifyFolder();
        expect(controller.useWorkspaceStore.getState().phase).toBe("broken");
        expect(controller.useWorkspaceStore.getState().error).toBe("workspace.reason.folder-missing");
        (current.root as unknown as { entries: typeof original }).entries = original;

        // Choosing a folder again (here the same one is back) goes through the normal connect.
        const options = { hideContact: false, now: 2 };
        await controller.connectFolder({ handle: STAND_IN, analysis: await controller.analyzeFolderHandle(STAND_IN, options), options });
        expect(controller.useWorkspaceStore.getState().phase).toBe("connected");
        expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("in-sync");
    });
});
