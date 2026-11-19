import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { makeLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
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

describe("workspace controller: documents coming and going", () => {
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

    it("mirrors a CV and a letter created later, and follows a rename", async () => {
        await connect();
        await db.resumes.put(makeWorkspaceCv({ id: "cv-2", title: "Designer" }));
        await db.coverLetters.put(makeLetter({ id: "l-1", cvId: "cv-1", title: "Acme" }));
        await wait(1300);
        expect(await current.listExternal("cvs")).toContain("Designer.cv.json");
        expect(await current.listExternal("letters")).toContain("Acme.letter.json");

        await db.resumes.update("cv-2", { meta: { ...(await db.resumes.get("cv-2"))!.meta, title: "Product Designer" } });
        await wait(1300);
        expect(await current.listExternal("cvs")).toContain("Product Designer.cv.json");
        expect(await current.listExternal("cvs")).not.toContain("Designer.cv.json");
        expect((await db.workspaceDocs.get("cv-2"))?.state).toBe("in-sync");
    });

    it("asks nothing about a document that was never in the folder, and keeps or deletes the file on request", async () => {
        const { retireBeforeDelete, documentHasWorkspaceFile } = await connect();
        expect(await documentHasWorkspaceFile("cv-1")).toBe(true);
        expect(await documentHasWorkspaceFile("nope")).toBe(false);
        await retireBeforeDelete("cv-1", "delete-file");
        expect(await current.readExternal("cvs/Master CV.cv.json")).toBeNull();
        expect(await documentHasWorkspaceFile("cv-1")).toBe(false);
    });

    it("excluding stops syncing without touching the file; including again takes the chosen side", async () => {
        const { excludeFromWorkspace, includeInWorkspace } = await connect();
        await excludeFromWorkspace("cv-1");
        const before = await current.readExternal("cvs/Master CV.cv.json");
        await db.resumes.update("cv-1", { basics: { ...(await db.resumes.get("cv-1"))!.basics, headline: "Changed while excluded" } });
        await wait(1300);
        expect(await current.readExternal("cvs/Master CV.cv.json")).toBe(before);

        expect(await includeInWorkspace("cv-1", "keep-app")).toBe(true);
        expect(JSON.parse((await current.readExternal("cvs/Master CV.cv.json"))!).basics.headline).toBe("Changed while excluded");
        expect((await db.workspaceDocs.get("cv-1"))?.included).toBe(true);
    });
});
