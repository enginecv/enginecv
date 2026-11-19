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
const FILE = "cvs/Master CV.cv.json";
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect() {
    const controller = await import("./controller");
    const options = { hideContact: false, now: 1 };
    await controller.connectFolder({ handle: STAND_IN, analysis: await controller.analyzeFolderHandle(STAND_IN, options), options });
    await wait(100);
    return controller;
}

describe("workspace controller: storage full or unavailable", () => {
    beforeEach(async () => {
        (await import("./controller")).resetWorkspaceController();
        current = createMemoryDirectory("applications");
        await resetLetterTables();
        await db.workspace.clear();
        await db.workspaceDocs.clear();
        await db.workspaceActivity.clear();
        await db.resumes.put(makeWorkspaceCv({ id: "cv-1", title: "Master CV" }));
    });
    afterEach(async () => {
        vi.restoreAllMocks();
        (await import("./controller")).resetWorkspaceController();
    });

    it("a full disk leaves the file untouched and unfinished, says why, and writes once there is room", async () => {
        const controller = await connect();
        const before = await current.readExternal(FILE);
        current.failNext("Master CV.cv.json", "write", "QuotaExceededError", 1);
        await db.resumes.update("cv-1", { basics: { ...(await db.resumes.get("cv-1"))!.basics, headline: "Needs room" } });
        await wait(1100);
        expect(await current.readExternal(FILE)).toBe(before); // no partial file
        expect((await current.listExternal("cvs")).filter((name) => name.endsWith(".crswap"))).toEqual([]);
        expect(await db.workspaceDocs.get("cv-1")).toMatchObject({ state: "busy", reason: { code: "storage-full" } });
        expect((await db.resumes.get("cv-1"))?.basics.headline).toBe("Needs room"); // the work stays in the app

        await wait(2700);
        expect(JSON.parse((await current.readExternal(FILE))!).basics.headline).toBe("Needs room");
        expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("in-sync");
        expect(controller.useWorkspaceStore.getState().storageProblem).toBe(false);
    }, 20_000);

    it("when the app's own records cannot be saved, it says so and the documents are untouched", async () => {
        const controller = await connect();
        const quota = Object.assign(new Error("full"), { name: "QuotaExceededError" });
        vi.spyOn(db.workspaceDocs, "update").mockRejectedValue(quota);
        vi.spyOn(db.workspaceDocs, "put").mockRejectedValue(quota);
        await db.resumes.update("cv-1", { basics: { ...(await db.resumes.get("cv-1"))!.basics, headline: "Saved anyway" } });
        await wait(1500);
        expect(controller.useWorkspaceStore.getState().storageProblem).toBe(true);
        expect((await db.resumes.get("cv-1"))?.basics.headline).toBe("Saved anyway");
        expect(JSON.parse((await current.readExternal(FILE))!).basics.headline).toBe("Saved anyway");
    }, 20_000);
});
