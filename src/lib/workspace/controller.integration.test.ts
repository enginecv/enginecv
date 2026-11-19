import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { makeLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";
import { createDirectoryAdapter as realCreateAdapter } from "./directory-adapter";

let current = createMemoryDirectory("applications");
vi.mock("./directory-adapter", async (importOriginal) => {
    const actual = await importOriginal<typeof import("./directory-adapter")>();
    return {
        ...actual,
        isWorkspaceSupported: () => true,
        // Whatever handle is stored, the adapter talks to the in-memory folder.
        createDirectoryAdapter: () => actual.createDirectoryAdapter(current.root as unknown as FileSystemDirectoryHandle),
    };
});
vi.mock("./leader", () => ({
    createLeader: () => ({ start() {}, stop() {}, isLeader: true, onChange: (listener: (value: boolean) => void) => { listener(true); return () => undefined; }, nudge() {}, onNudge: () => () => undefined }),
}));

const STAND_IN = { kind: "directory", name: "applications" } as unknown as FileSystemDirectoryHandle;

describe("workspace controller", () => {
    beforeEach(async () => {
        const controller = await import("./controller");
        controller.resetWorkspaceController();
        current = createMemoryDirectory("applications");
        await resetLetterTables();
        await db.workspace.clear();
        await db.workspaceDocs.clear();
        await db.resumes.put(makeWorkspaceCv({ id: "cv-1", title: "Master CV" }));
        await db.coverLetters.put(makeLetter({ id: "l-1", cvId: "cv-1", company: "Acme" }));
    });
    afterEach(async () => {
        (await import("./controller")).resetWorkspaceController();
    });

    it("starts with no workspace", async () => {
        const { initWorkspace, useWorkspaceStore } = await import("./controller");
        await initWorkspace();
        expect(useWorkspaceStore.getState().phase).toBe("none");
    });

    it("connects a folder: files are written and the panel state says connected", async () => {
        const { analyzeFolderHandle, connectFolder, useWorkspaceStore } = await import("./controller");
        const options = { hideContact: false, now: 1 };
        const analysis = await analyzeFolderHandle(STAND_IN, options);
        const result = await connectFolder({ handle: STAND_IN, analysis, options });
        expect(result.written).toBe(2);
        const state = useWorkspaceStore.getState();
        expect(state).toMatchObject({ phase: "connected", folderName: "applications", hideContact: false, docCount: 2, isLeader: true });
        expect(await current.readExternal("AGENTS.md")).not.toBeNull();
    });

    it("restores a stored workspace when the app starts, and asks for permission when the browser wants it", async () => {
        const { analyzeFolderHandle, connectFolder, initWorkspace, resumePermission, resetWorkspaceController, useWorkspaceStore } = await import("./controller");
        const options = { hideContact: false, now: 1 };
        await connectFolder({ handle: STAND_IN, analysis: await analyzeFolderHandle(STAND_IN, options), options });
        resetWorkspaceController();

        await initWorkspace();
        expect(useWorkspaceStore.getState().phase).toBe("connected");

        resetWorkspaceController();
        current.setPermission("prompt", "granted");
        await initWorkspace();
        expect(useWorkspaceStore.getState().phase).toBe("needs-permission");
        expect(await resumePermission()).toBe(true);
        expect(useWorkspaceStore.getState().phase).toBe("connected");
    });

    it("stays in needs-permission when the person declines", async () => {
        const { analyzeFolderHandle, connectFolder, initWorkspace, resumePermission, resetWorkspaceController, useWorkspaceStore } = await import("./controller");
        const options = { hideContact: false, now: 1 };
        await connectFolder({ handle: STAND_IN, analysis: await analyzeFolderHandle(STAND_IN, options), options });
        resetWorkspaceController();
        current.setPermission("prompt", "denied");
        await initWorkspace();
        expect(await resumePermission()).toBe(false);
        expect(useWorkspaceStore.getState().phase).toBe("needs-permission");
    });

    it("disconnecting leaves every file and every document exactly as it was", async () => {
        const { analyzeFolderHandle, connectFolder, disconnectWorkspace, useWorkspaceStore } = await import("./controller");
        const options = { hideContact: false, now: 1 };
        await connectFolder({ handle: STAND_IN, analysis: await analyzeFolderHandle(STAND_IN, options), options });
        const filesBefore = await current.listExternal("cvs");
        const cvBefore = JSON.stringify(await db.resumes.get("cv-1"));
        const letterBefore = JSON.stringify(await db.coverLetters.get("l-1"));

        await disconnectWorkspace();
        expect(useWorkspaceStore.getState().phase).toBe("none");
        expect(await db.workspace.count()).toBe(0);
        expect(await db.workspaceDocs.count()).toBe(0);
        expect(await current.listExternal("cvs")).toEqual(filesBefore);
        expect(JSON.stringify(await db.resumes.get("cv-1"))).toBe(cvBefore);
        expect(JSON.stringify(await db.coverLetters.get("l-1"))).toBe(letterBefore);
    });

    it("pauses and resumes, remembering the choice", async () => {
        const { analyzeFolderHandle, connectFolder, setPaused, useWorkspaceStore } = await import("./controller");
        const options = { hideContact: false, now: 1 };
        await connectFolder({ handle: STAND_IN, analysis: await analyzeFolderHandle(STAND_IN, options), options });
        await setPaused(true);
        expect(useWorkspaceStore.getState().paused).toBe(true);
        expect((await db.workspace.get("current"))?.paused).toBe(true);
        await setPaused(false);
        expect((await db.workspace.get("current"))?.paused).toBe(false);
        expect(realCreateAdapter).toBeDefined();
    });
});
