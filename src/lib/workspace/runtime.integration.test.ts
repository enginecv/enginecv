import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { loadResumeHistory } from "@/lib/history";
import { useResumeStore } from "@/lib/store";
import { resetLetterTables } from "../../../test/setup/letter-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { cvFileText, editFile, makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";
import { readAppDocuments } from "./apply-stored";
import { createChangeSource, type ChangeSource } from "./change-source";
import { createDirectoryAdapter } from "./directory-adapter";
import { createWorkspaceRuntime, type WorkspaceRuntime } from "./runtime";
import { analyzeFolder, runSetup } from "./setup";

const STAND_IN = { kind: "directory", name: "w" } as unknown as FileSystemDirectoryHandle;
const FILE = "cvs/Master CV.cv.json";

/** A change source that only fires when the test says so. */
const quietSource = (): ChangeSource => ({ kind: "poll", slow: false, async start() {}, stop() {}, nudge() {}, onVisibilityChange() {} });

async function connected(options: { polling?: boolean } = {}) {
    const dir = createMemoryDirectory("w");
    const adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
    const docs = await readAppDocuments();
    const analysis = await analyzeFolder(adapter, docs, { hideContact: false, now: 1 });
    await runSetup({ adapter, handle: STAND_IN, plan: analysis.plan, appDocs: analysis.appDocs, docs, options: { hideContact: false, now: 1 } });
    const runtime = createWorkspaceRuntime({
        adapter,
        hideContact: () => false,
        isVisible: () => true,
        createSource: options.polling ? (onChange) => createChangeSource({ adapter, folders: ["cvs", "letters"], onPossibleChange: onChange, isVisible: () => true }) : quietSource,
    });
    await runtime.start();
    return { dir, adapter, runtime };
}

describe("workspace runtime: outside edits", () => {
    let current: WorkspaceRuntime | null = null;
    beforeEach(async () => {
        await resetLetterTables();
        await db.workspace.clear();
        await db.workspaceDocs.clear();
        await db.resumeHistory.clear();
        const cv = makeWorkspaceCv({ id: "cv-1", title: "Master CV" });
        await db.resumes.put({ ...cv, basics: { ...cv.basics, photo: "data:image/png;base64,AAAA" } });
        useResumeStore.setState({ activeResumeId: null, isDirty: false });
    });
    afterEach(() => {
        current?.stop();
        current = null;
        useResumeStore.setState({ activeResumeId: null, isDirty: false });
    });

    it("applies an outside edit to a closed CV, keeps design, photo and signature, and takes a restore point first", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const before = (await db.resumes.get("cv-1"))!;
        const edited = editFile((await dir.readExternal(FILE))!, (doc) => {
            (doc.basics as Record<string, unknown>).headline = "Edited by an agent";
        });
        await dir.writeExternal(FILE, edited);
        await runtime.checkNow();

        const after = (await db.resumes.get("cv-1"))!;
        expect(after.basics.headline).toBe("Edited by an agent");
        expect(after.basics.photo).toBe("data:image/png;base64,AAAA");
        expect(after.settings).toEqual(before.settings);
        expect(after.meta.title).toBe(before.meta.title);
        const history = await loadResumeHistory("cv-1");
        expect(history[0].trigger).toBe("file-sync");
        expect(JSON.parse(history[0].resumeJson).basics.headline).toBe(before.basics.headline);
        expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("in-sync");
    });

    it("leaves untouched parts of the CV unchanged when only one entry changes", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const before = (await db.resumes.get("cv-1"))!;
        const edited = editFile((await dir.readExternal(FILE))!, (doc) => {
            const experience = doc.experience as Array<Record<string, unknown>>;
            experience[0].position = "Changed role";
        });
        await dir.writeExternal(FILE, edited);
        await runtime.checkNow();
        const after = (await db.resumes.get("cv-1"))!;
        expect(after.experience[0].position).toBe("Changed role");
        // Dates are written in the file's own style, so compare everything else about the untouched entries.
        const stable = (entries: unknown[]) => entries.map((entry) => ({ ...(entry as Record<string, unknown>), start: undefined, end: undefined, date: undefined }));
        expect(stable(after.education)).toEqual(stable(before.education));
        const skillNames = (resume: typeof after) => resume.skillGroups.map((group) => [group.name, group.skills.map((skill) => skill.name)]);
        expect(skillNames(after)).toEqual(skillNames(before));
        expect(stable(after.experience.slice(1))).toEqual(stable(before.experience.slice(1)));
        expect(after.experience.map((entry) => entry.id)).toEqual(before.experience.map((entry) => entry.id));
    });

    it("applies the change through the editor when the CV is open, so the editor updates in place", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const row = (await db.resumes.get("cv-1"))!;
        useResumeStore.setState({ activeResumeId: "cv-1", resume: row, isDirty: false });
        const edited = editFile((await dir.readExternal(FILE))!, (doc) => {
            (doc.basics as Record<string, unknown>).headline = "Seen in the open editor";
        });
        await dir.writeExternal(FILE, edited);
        await runtime.checkNow();
        expect(useResumeStore.getState().resume.basics.headline).toBe("Seen in the open editor");
        expect(useResumeStore.getState().activeResumeId).toBe("cv-1");
    });

    it("saves typed but unsaved content first, so nothing the person typed is lost", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const row = (await db.resumes.get("cv-1"))!;
        const typed = { ...row, basics: { ...row.basics, headline: "Typed, not yet saved" }, updatedAt: row.updatedAt + 5 };
        useResumeStore.setState({ activeResumeId: "cv-1", resume: typed, isDirty: true });
        const edited = editFile((await dir.readExternal(FILE))!, (doc) => {
            (doc.basics as Record<string, unknown>).name = "Agent changed the name";
        });
        await dir.writeExternal(FILE, edited);
        await runtime.checkNow();
        const stored = await loadResumeHistory("cv-1");
        expect(stored.some((entry) => JSON.parse(entry.resumeJson).basics.headline === "Typed, not yet saved")).toBe(true);
        expect(useResumeStore.getState().resume.basics.name).toBe("Agent changed the name");
    });

    it("does not apply its own write again when the file is read back", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const edited = editFile((await dir.readExternal(FILE))!, (doc) => {
            (doc.basics as Record<string, unknown>).headline = "Once only";
        });
        await dir.writeExternal(FILE, edited);
        await runtime.checkNow();
        const afterFirst = (await loadResumeHistory("cv-1")).length;
        await runtime.checkNow();
        await runtime.checkNow();
        expect((await loadResumeHistory("cv-1")).length).toBe(afterFirst);
    });

    it("keeps the app's text when the file's content did not change at all", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const same = `${JSON.stringify(JSON.parse((await dir.readExternal(FILE))!))}\n`; // reformatted only
        await dir.writeExternal(FILE, same);
        await runtime.checkNow();
        expect(await loadResumeHistory("cv-1")).toEqual([]);
    });

    it("notices an outside edit within three seconds with the real polling change source", async () => {
        const { dir, runtime } = await connected({ polling: true });
        current = runtime;
        const edited = editFile((await dir.readExternal(FILE))!, (doc) => {
            (doc.basics as Record<string, unknown>).headline = "Found by polling";
        });
        const started = Date.now();
        await dir.writeExternal(FILE, edited);
        await vi.waitFor(async () => expect((await db.resumes.get("cv-1"))?.basics.headline).toBe("Found by polling"), { timeout: 3000, interval: 100 });
        expect(Date.now() - started).toBeLessThan(3000);
    }, 10_000);

    it("ignores a CV that is not included in the workspace", async () => {
        const dir = createMemoryDirectory("w");
        const adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
        const docs = await readAppDocuments();
        const analysis = await analyzeFolder(adapter, docs, { hideContact: false, now: 1 });
        await runSetup({ adapter, handle: STAND_IN, plan: analysis.plan, appDocs: analysis.appDocs, docs, options: { hideContact: false, now: 1 } });
        await db.workspaceDocs.update("cv-1", { included: false });
        const runtime = createWorkspaceRuntime({ adapter, hideContact: () => false, createSource: quietSource });
        current = runtime;
        await runtime.start();
        expect(runtime.engineFor("cv-1")).toBeUndefined();
        expect(cvFileText(makeWorkspaceCv()).length).toBeGreaterThan(0);
    });
});
