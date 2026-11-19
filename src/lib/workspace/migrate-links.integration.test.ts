import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { linkFile } from "@/lib/linked-file/link-actions";
import { resetLetterTables } from "../../../test/setup/letter-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";
import { readAppDocuments } from "./apply-stored";
import { createDirectoryAdapter } from "./directory-adapter";
import { includeDocument, mirrorDocuments } from "./lifecycle";
import { isInWorkspace, isLinkedCv } from "./link-guard";
import { listLinkedCvs, moveLinkedCv, moveLinkedCvs } from "./migrate-links";
import { analyzeFolder, runSetup } from "./setup";

const STAND_IN = { kind: "directory", name: "w" } as unknown as FileSystemDirectoryHandle;
const FILE_STAND_IN = { kind: "file", name: "old.enginecv.json" } as unknown as FileSystemFileHandle;
const options = { hideContact: false };

async function link(resumeId: string) {
    await db.linkedFiles.put({ resumeId, handle: FILE_STAND_IN, fileName: "old.enginecv.json", linkedAt: 1, paused: false });
}

async function setup(choose?: (key: string, choice: string) => string) {
    const dir = createMemoryDirectory("w");
    const adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
    const docs = await readAppDocuments();
    const analysis = await analyzeFolder(adapter, docs, { hideContact: false, now: 1 });
    const plan = analysis.plan.map((item) => (choose ? { ...item, choice: choose(item.key, item.choice) as typeof item.choice } : item));
    const result = await runSetup({ adapter, handle: STAND_IN, plan, appDocs: analysis.appDocs, docs, options: { hideContact: false, now: 1 } });
    return { dir, adapter, analysis, result };
}

describe("moving linked CVs into the workspace", () => {
    beforeEach(async () => {
        await resetLetterTables();
        await db.workspace.clear();
        await db.workspaceDocs.clear();
        await db.linkedFiles.clear();
        await db.resumes.put(makeWorkspaceCv({ id: "cv-1", title: "Master CV" }));
        await db.resumes.put(makeWorkspaceCv({ id: "cv-2", title: "Other CV" }));
        await link("cv-1");
    });

    it("lists linked CVs that still exist, and offers the move in the first-sync plan", async () => {
        expect(await listLinkedCvs()).toEqual([{ resumeId: "cv-1", title: "Master CV", fileName: "old.enginecv.json" }]);
        const dir = createMemoryDirectory("w");
        const analysis = await analyzeFolder(createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle), await readAppDocuments(), { hideContact: false, now: 1 });
        const linkedItems = analysis.plan.filter((item) => item.linked);
        expect(linkedItems.map((item) => item.docId)).toEqual(["cv-1"]);
        expect(linkedItems[0].choice).toBe("keep-app"); // the default is to move
        expect(analysis.plan.find((item) => item.docId === "cv-2")?.linked).toBeUndefined();
        await db.resumes.delete("cv-1");
        expect(await listLinkedCvs()).toEqual([]); // a link to a CV that is gone is not offered
    });

    it("moves a linked CV at setup: its file appears in the folder, its link ends, the old link's file is untouched", async () => {
        const { dir, result } = await setup();
        expect(result.moved).toBe(1);
        expect(await dir.readExternal("cvs/Master CV.cv.json")).not.toBeNull();
        expect(await isLinkedCv("cv-1")).toBe(false);
        expect(await isInWorkspace("cv-1")).toBe(true);
        expect(await db.resumes.get("cv-1")).toBeDefined(); // the CV itself is untouched
    });

    it("keeps the link when the person chooses to keep it: no file, no workspace row included", async () => {
        const { dir, result } = await setup((key, choice) => (key === "app:cv-1" ? "skip" : choice));
        expect(result.moved).toBe(0);
        expect(await isLinkedCv("cv-1")).toBe(true);
        expect(await isInWorkspace("cv-1")).toBe(false);
        expect(await dir.readExternal("cvs/Master CV.cv.json")).toBeNull();
        expect(await dir.readExternal("cvs/Other CV.cv.json")).not.toBeNull(); // the unlinked CV is in as usual
    });

    it("never mirrors or includes a linked CV until it is moved", async () => {
        const { dir, adapter } = await setup((key, choice) => (key === "app:cv-1" ? "skip" : choice));
        await db.resumes.put(makeWorkspaceCv({ id: "cv-3", title: "Linked later" }));
        await link("cv-3");
        await mirrorDocuments(adapter, options);
        expect(await dir.readExternal("cvs/Linked later.cv.json")).toBeNull();
        expect(await db.workspaceDocs.get("cv-3")).toBeUndefined();
        expect(await includeDocument(adapter, "cv-1", "keep-app", options)).toMatchObject({ ok: false });
    });

    it("moves a CV later, from the banner, writing the file before ending the link", async () => {
        const { dir, adapter } = await setup((key, choice) => (key === "app:cv-1" ? "skip" : choice));
        expect(await moveLinkedCv(adapter, "cv-1", options)).toEqual({ ok: true });
        expect(await dir.readExternal("cvs/Master CV.cv.json")).not.toBeNull();
        expect(await isLinkedCv("cv-1")).toBe(false);
        expect(await moveLinkedCv(adapter, "cv-1", options)).toEqual({ ok: false, reason: "not-linked" });
    });

    it("keeps the link, and loses nothing, when the file cannot be written", async () => {
        const { dir, adapter } = await setup((key, choice) => (key === "app:cv-1" ? "skip" : choice));
        dir.failNext("Master CV.cv.json", "write", "NotAllowedError", 1);
        expect(await moveLinkedCv(adapter, "cv-1", options)).toEqual({ ok: false, reason: "failed" });
        expect(await isLinkedCv("cv-1")).toBe(true); // never neither
        expect(await isInWorkspace("cv-1")).toBe(false); // never both
        const again = await moveLinkedCvs(adapter, ["cv-1"], options);
        expect(again).toEqual({ moved: ["cv-1"], failed: [] });
    });

    it("never lets a CV in the workspace be linked to a single file", async () => {
        await setup();
        const result = await linkFile("cv-1", "createNew", { pickNew: async () => { throw new Error("must not even ask for a file"); } });
        expect(result).toEqual({ ok: false, reason: "in-workspace" });
        expect(await isLinkedCv("cv-1")).toBe(false);
    });

    it("lets a CV that is not in the workspace be linked as before", async () => {
        await setup((key, choice) => (key === "app:cv-2" ? "skip" : choice));
        expect(await isInWorkspace("cv-2")).toBe(false);
        const result = await linkFile("cv-2", "createNew", { pickNew: async () => null });
        expect(result).toEqual({ ok: false, reason: "cancelled" });
    });
});
