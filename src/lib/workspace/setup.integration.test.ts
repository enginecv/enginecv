import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { makeLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { cvFileText, editFile, makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";
import { readAppDocuments } from "./apply-stored";
import { createDirectoryAdapter } from "./directory-adapter";
import { analyzeFolder, runSetup } from "./setup";
import { getWorkspace } from "./workspace-store";

const options = { hideContact: false, now: 5000 };
// The browser stores a real handle; fake-indexeddb needs something cloneable, so tests store a stand-in.
const STAND_IN = { kind: "directory", name: "applications" } as unknown as FileSystemDirectoryHandle;

async function setup(dir = createMemoryDirectory("applications"), opts = options) {
    const adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
    const docs = await readAppDocuments();
    const analysis = await analyzeFolder(adapter, docs, opts);
    return { dir, adapter, docs, analysis, run: () => runSetup({ adapter, handle: STAND_IN, plan: analysis.plan, appDocs: analysis.appDocs, docs, options: opts }) };
}

describe("workspace setup", () => {
    beforeEach(async () => {
        await resetLetterTables();
        await db.workspace.clear();
        await db.workspaceDocs.clear();
        await db.resumes.bulkPut([makeWorkspaceCv({ id: "cv-1", title: "Master CV" }), makeWorkspaceCv({ id: "cv-2", title: "Research CV", name: "Second" })]);
        await db.coverLetters.bulkPut([makeLetter({ id: "l-1", cvId: "cv-1", company: "Acme" }), makeLetter({ id: "l-2", cvId: "cv-1", company: "Globex" }), makeLetter({ id: "l-3", cvId: "cv-2", company: "Initech" })]);
    });

    it("writes one file per CV and letter, the instructions, the index and an exports folder", async () => {
        const { run, dir } = await setup();
        const result = await run();
        expect(result).toMatchObject({ written: 5, applied: 0, imported: 0, failed: [] });

        expect(await dir.listExternal("cvs")).toEqual([".keep", "Master CV.cv.json", "Research CV.cv.json"]);
        expect((await dir.listExternal("letters")).filter((name) => name.endsWith(".letter.json"))).toHaveLength(3);
        for (const name of ["AGENTS.md", "README.md", ".enginecv/index.json", ".enginecv/workspace.json", ".enginecv/.gitignore"]) expect(await dir.readExternal(name), name).not.toBeNull();
        expect(await dir.listExternal("")).toContain("exports");

        const index = JSON.parse((await dir.readExternal(".enginecv/index.json"))!);
        expect(index.cvs).toHaveLength(2);
        expect(index.letters).toHaveLength(3);
        expect(await getWorkspace()).toMatchObject({ folderName: "applications", hideContact: false });
        expect(await db.workspaceDocs.count()).toBe(5);
    });

    it("writes readable files a person can open in a text editor", async () => {
        const { run, dir } = await setup();
        await run();
        const cv = JSON.parse((await dir.readExternal("cvs/Master CV.cv.json"))!);
        expect(cv.id).toBe("cv-1");
        expect(cv.format).toBe("enginecv.authoring/v1");
        const letterName = (await dir.listExternal("letters")).find((name) => name.includes("Acme"))!;
        expect(JSON.parse((await dir.readExternal(`letters/${letterName}`))!)).toMatchObject({ id: "l-1", cv: { id: "cv-1", title: "Master CV" }, company: "Acme" });
    });

    it("leaves contact details out of the files when asked, keeping them in the app", async () => {
        const { run, dir } = await setup(createMemoryDirectory("w"), { hideContact: true, now: 1 });
        await run();
        const text = (await dir.readExternal("cvs/Master CV.cv.json"))!;
        expect(text).not.toContain("amina@example.com");
        expect(text).not.toContain("+49 30 1234567");
        expect((await db.resumes.get("cv-1"))?.basics.email).toBe("amina@example.com");
        expect((await getWorkspace())?.hideContact).toBe(true);
    });

    it("re-setup of a folder this app wrote needs no action and writes nothing new", async () => {
        const first = await setup();
        await first.run();
        const again = await setup(first.dir);
        expect(again.analysis.plan.every((item) => item.class === "same")).toBe(true);
        const result = await again.run();
        expect(result).toMatchObject({ written: 0, applied: 0, imported: 0, kept: 0 });
        expect(await db.workspaceDocs.count()).toBe(5);
    });

    it("lists a differing file, keeps the app's version by default and backs the old file up", async () => {
        const dir = createMemoryDirectory("w");
        const edited = editFile(cvFileText(makeWorkspaceCv({ id: "cv-1", title: "Master CV" })), (doc) => {
            (doc.basics as Record<string, unknown>).headline = "Written by an agent";
        });
        await dir.writeExternal("cvs/Master CV.cv.json", edited);
        const { analysis, run } = await setup(dir);
        const item = analysis.plan.find((entry) => entry.docId === "cv-1")!;
        expect(item).toMatchObject({ class: "differs", choice: "keep-app" });
        await run();
        expect(JSON.parse((await dir.readExternal("cvs/Master CV.cv.json"))!).basics.headline).not.toBe("Written by an agent");
        const backups = (await dir.listExternal(".enginecv/conflicts")).filter((name) => name.endsWith(".bak"));
        expect(backups).toHaveLength(1);
        expect(await dir.readExternal(`.enginecv/conflicts/${backups[0]}`)).toBe(edited);
    });

    it("uses the file's version when chosen, after taking a restore point", async () => {
        const dir = createMemoryDirectory("w");
        const edited = editFile(cvFileText(makeWorkspaceCv({ id: "cv-1", title: "Master CV" })), (doc) => {
            (doc.basics as Record<string, unknown>).headline = "From the file";
        });
        await dir.writeExternal("cvs/Master CV.cv.json", edited);
        const { analysis, adapter, docs } = await setup(dir);
        const plan = analysis.plan.map((item) => (item.docId === "cv-1" ? { ...item, choice: "use-file" as const } : item));
        const result = await runSetup({ adapter, handle: STAND_IN, plan, appDocs: analysis.appDocs, docs, options });
        expect(result.applied).toBe(1);
        expect((await db.resumes.get("cv-1"))?.basics.headline).toBe("From the file");
        expect((await db.resumeHistory.where("resumeId").equals("cv-1").toArray())[0].trigger).toBe("file-sync");
        expect(await dir.readExternal("cvs/Master CV.cv.json")).toBe(edited);
    });

    it("imports an unfamiliar file only when ticked", async () => {
        const dir = createMemoryDirectory("w");
        const stranger = cvFileText(makeWorkspaceCv({ id: "cv-stranger", title: "Stranger", name: "Someone Else" }));
        await dir.writeExternal("cvs/stranger.cv.json", stranger);
        const first = await setup(dir);
        const row = first.analysis.plan.find((entry) => entry.fileName === "stranger.cv.json")!;
        expect(row).toMatchObject({ class: "only-in-folder", choice: "skip" });
        await first.run();
        expect(await db.resumes.get("cv-stranger")).toBeUndefined();

        const second = await setup(dir);
        const plan = second.analysis.plan.map((item) => (item.fileName === "stranger.cv.json" ? { ...item, choice: "import" as const } : item));
        const result = await runSetup({ adapter: second.adapter, handle: STAND_IN, plan, appDocs: second.analysis.appDocs, docs: second.docs, options });
        expect(result.imported).toBe(1);
        expect((await db.resumes.get("cv-stranger"))?.basics.name).toBe("Someone Else");
    });

    it("never overwrites a README or AGENTS.md the person edited", async () => {
        const dir = createMemoryDirectory("w");
        await dir.writeExternal("AGENTS.md", "My own rules for agents.");
        const { run } = await setup(dir);
        await run();
        expect(await dir.readExternal("AGENTS.md")).toBe("My own rules for agents.");
        expect(await dir.readExternal("README.md")).toContain("EngineCV workspace folder");
    });

    it("ignores swap files and sync-tool conflict copies when proposing a plan", async () => {
        const dir = createMemoryDirectory("w");
        const text = cvFileText(makeWorkspaceCv({ id: "cv-1", title: "Master CV" }));
        await dir.writeExternal("cvs/Master CV.cv.json", text);
        await dir.writeExternal("cvs/master-cv (conflicted copy 2026-11-19).cv.json", text);
        await dir.writeExternal("cvs/master-cv.cv.json.crswap", "partial");
        const { analysis } = await setup(dir);
        expect(analysis.plan.filter((item) => item.fileName?.includes("conflicted"))).toEqual([]);
        expect(analysis.skipped).toContain("master-cv (conflicted copy 2026-11-19).cv.json");
    });
});
