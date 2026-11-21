import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { makeLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { cvFileText, makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";
import { readAppDocuments } from "./apply-stored";
import { createDirectoryAdapter } from "./directory-adapter";
import { excludeDocument, includeDocument, mirrorDocuments, retireDocument } from "./lifecycle";
import { analyzeFolder, runSetup } from "./setup";

const STAND_IN = { kind: "directory", name: "w" } as unknown as FileSystemDirectoryHandle;
const options = { hideContact: false };

async function connected() {
    const dir = createMemoryDirectory("w");
    const adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
    const docs = await readAppDocuments();
    const analysis = await analyzeFolder(adapter, docs, { hideContact: false, now: 1 });
    await runSetup({ adapter, handle: STAND_IN, plan: analysis.plan, appDocs: analysis.appDocs, docs, options: { hideContact: false, now: 1 } });
    return { dir, adapter };
}

describe("workspace document lifecycle", () => {
    beforeEach(async () => {
        await resetLetterTables();
        await db.workspace.clear();
        await db.workspaceDocs.clear();
        await db.resumes.put(makeWorkspaceCv({ id: "cv-1", title: "Master CV" }));
    });

    it("gives a new CV and a new letter their own files and rows", async () => {
        const { dir, adapter } = await connected();
        await db.resumes.put(makeWorkspaceCv({ id: "cv-2", title: "Designer CV" }));
        await db.coverLetters.put(makeLetter({ id: "l-1", cvId: "cv-1", title: "Acme" }));
        const result = await mirrorDocuments(adapter, options);
        expect(result.created.sort()).toEqual(["cv-2", "l-1"]);
        expect(await dir.listExternal("cvs")).toContain("Designer CV.cv.json");
        expect(await dir.listExternal("letters")).toContain("Acme.letter.json");
        expect(await db.workspaceDocs.get("cv-2")).toMatchObject({ included: true, state: "in-sync", fileName: "Designer CV.cv.json" });
        expect((await mirrorDocuments(adapter, options)).created).toEqual([]); // idempotent
    });

    it("never gives a new document the name of an existing file, even in another case", async () => {
        const { dir, adapter } = await connected();
        await db.resumes.put(makeWorkspaceCv({ id: "cv-2", title: "MASTER cv" }));
        await mirrorDocuments(adapter, options);
        const names = (await dir.listExternal("cvs")).filter((name) => name.endsWith(".json"));
        expect(names).toHaveLength(2);
        expect(new Set(names.map((name) => name.toLowerCase())).size).toBe(2);
    });

    it("renames the file when the title changes, keeping its content, and never onto an existing name", async () => {
        const { dir, adapter } = await connected();
        const before = await dir.readExternal("cvs/Master CV.cv.json");
        await db.resumes.update("cv-1", { meta: { ...(await db.resumes.get("cv-1"))!.meta, title: "Renamed CV" } });
        expect((await mirrorDocuments(adapter, options)).renamed).toEqual(["cv-1"]);
        expect(await dir.readExternal("cvs/Master CV.cv.json")).toBeNull();
        expect(await dir.readExternal("cvs/Renamed CV.cv.json")).toBe(before);
        expect((await db.workspaceDocs.get("cv-1"))?.fileName).toBe("Renamed CV.cv.json");

        await db.resumes.put(makeWorkspaceCv({ id: "cv-2", title: "Other" }));
        await mirrorDocuments(adapter, options);
        await db.resumes.update("cv-2", { meta: { ...(await db.resumes.get("cv-2"))!.meta, title: "renamed cv" } });
        await mirrorDocuments(adapter, options);
        const row2 = (await db.workspaceDocs.get("cv-2"))!;
        expect(row2.fileName!.toLowerCase()).not.toBe("renamed cv.cv.json");
        expect(await dir.readExternal("cvs/Renamed CV.cv.json")).toBe(before);
    });

    it("keeps a file name someone chose in their file manager until the title changes in the app", async () => {
        const { dir, adapter } = await connected();
        // Renamed in the file manager: the document follows by id and the name sticks.
        const text = await dir.readExternal("cvs/Master CV.cv.json");
        await dir.writeExternal("cvs/My Own Name.cv.json", text!);
        await dir.removeExternal("cvs/Master CV.cv.json");
        await db.workspaceDocs.update("cv-1", { fileName: "My Own Name.cv.json" });
        await mirrorDocuments(adapter, options);
        await mirrorDocuments(adapter, options);
        expect(await dir.readExternal("cvs/My Own Name.cv.json")).toBe(text);
        expect(await dir.readExternal("cvs/Master CV.cv.json")).toBeNull();

        // A new title in the app does rename it.
        await db.resumes.update("cv-1", { meta: { ...(await db.resumes.get("cv-1"))!.meta, title: "Fresh Title" } });
        await mirrorDocuments(adapter, options);
        expect(await dir.readExternal("cvs/Fresh Title.cv.json")).toBe(text);
        expect(await dir.readExternal("cvs/My Own Name.cv.json")).toBeNull();
    });

    it("only drops the row of a document deleted elsewhere; its file stays", async () => {
        const { dir, adapter } = await connected();
        await db.resumes.delete("cv-1");
        expect((await mirrorDocuments(adapter, options)).orphaned).toEqual(["cv-1"]);
        expect(await db.workspaceDocs.get("cv-1")).toBeUndefined();
        expect(await dir.readExternal("cvs/Master CV.cv.json")).not.toBeNull();
    });

    it("deleting a document: keep the file, or delete it after copying it to conflicts", async () => {
        const { dir, adapter } = await connected();
        await db.resumes.put(makeWorkspaceCv({ id: "cv-2", title: "Second" }));
        await mirrorDocuments(adapter, options);

        await retireDocument(adapter, "cv-1", "keep-file", 5);
        expect(await dir.readExternal("cvs/Master CV.cv.json")).not.toBeNull();
        expect(await db.workspaceDocs.get("cv-1")).toBeUndefined();

        await retireDocument(adapter, "cv-2", "delete-file", 7);
        expect(await dir.readExternal("cvs/Second.cv.json")).toBeNull();
        expect((await dir.listExternal(".enginecv/conflicts")).some((name) => name.includes("Second") && name.includes(".7."))).toBe(true);
    });

    it("leaves a document out of the folder without touching its file, and brings it back with a choice", async () => {
        const { dir, adapter } = await connected();
        await excludeDocument("cv-1");
        expect((await db.workspaceDocs.get("cv-1"))?.included).toBe(false);
        expect(await dir.readExternal("cvs/Master CV.cv.json")).not.toBeNull();
        expect((await mirrorDocuments(adapter, options)).renamed).toEqual([]); // excluded rows are not touched

        // The file changed outside meanwhile; keep the app's version: the file's text is copied first.
        const edited = cvFileText({ ...makeWorkspaceCv({ id: "cv-1", title: "Master CV" }), basics: { ...makeWorkspaceCv().basics, headline: "From file" } });
        await dir.writeExternal("cvs/Master CV.cv.json", edited);
        const kept = await includeDocument(adapter, "cv-1", "keep-app", { ...options, now: 9 });
        expect(kept.ok).toBe(true);
        const backup = (await dir.listExternal(".enginecv/conflicts")).find((name) => name.includes("Master CV") && name.includes(".9."));
        expect(await dir.readExternal(`.enginecv/conflicts/${backup}`)).toBe(edited);
        expect((await db.resumes.get("cv-1"))?.basics.headline).not.toBe("From file");
        expect((await db.workspaceDocs.get("cv-1"))?.included).toBe(true);

        await excludeDocument("cv-1");
        await dir.writeExternal("cvs/Master CV.cv.json", edited);
        await includeDocument(adapter, "cv-1", "use-file", options);
        expect((await db.resumes.get("cv-1"))?.basics.headline).toBe("From file");
    });

    it("writes a file when a document is included that has none", async () => {
        const { dir, adapter } = await connected();
        await excludeDocument("cv-1");
        await dir.removeExternal("cvs/Master CV.cv.json");
        const result = await includeDocument(adapter, "cv-1", "use-file", options);
        expect(result.ok).toBe(true);
        expect(await dir.readExternal("cvs/Master CV.cv.json")).not.toBeNull();
    });
});
