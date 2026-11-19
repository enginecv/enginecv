import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { useResumeStore } from "@/lib/store";
import { resetLetterTables } from "../../../test/setup/letter-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { editFile, makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";
import { readAppDocuments } from "./apply-stored";
import type { ChangeSource } from "./change-source";
import { createDirectoryAdapter } from "./directory-adapter";
import { relinkDocument } from "./documents";
import { createWorkspaceRuntime, type RuntimeEvents, type WorkspaceRuntime } from "./runtime";
import { analyzeFolder, runSetup } from "./setup";

const STAND_IN = { kind: "directory", name: "w" } as unknown as FileSystemDirectoryHandle;
const FILE = "cvs/Master CV.cv.json";
const quietSource = (): ChangeSource => ({ kind: "poll", slow: false, async start() {}, stop() {}, nudge() {}, onVisibilityChange() {} });
const flush = () => new Promise((resolve) => setTimeout(resolve, 30));

async function connected() {
    const dir = createMemoryDirectory("w");
    const adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
    const docs = await readAppDocuments();
    const analysis = await analyzeFolder(adapter, docs, { hideContact: false, now: 1 });
    await runSetup({ adapter, handle: STAND_IN, plan: analysis.plan, appDocs: analysis.appDocs, docs, options: { hideContact: false, now: 1 } });
    const attention: Array<Parameters<NonNullable<RuntimeEvents["onAttention"]>>[0]> = [];
    const runtime = createWorkspaceRuntime({ adapter, hideContact: () => false, isVisible: () => true, createSource: quietSource, events: { onAttention: (info) => attention.push(info) } });
    await runtime.start();
    return { dir, adapter, runtime, attention };
}

describe("workspace runtime: who is who in the folder", () => {
    let current: WorkspaceRuntime | null = null;
    beforeEach(async () => {
        await resetLetterTables();
        await db.workspace.clear();
        await db.workspaceDocs.clear();
        await db.workspaceActivity.clear();
        await db.resumeHistory.clear();
        await db.resumes.put(makeWorkspaceCv({ id: "cv-1", title: "Master CV" }));
        useResumeStore.setState({ activeResumeId: null, isDirty: false });
    });
    afterEach(() => {
        current?.stop();
        current = null;
    });

    it("follows a file renamed outside, matching it by the id inside, and keeps syncing under the new name", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const text = (await dir.readExternal(FILE))!;
        await dir.removeExternal(FILE);
        await dir.writeExternal("cvs/Renamed By Agent.cv.json", text);
        await runtime.checkNow();
        await flush();
        expect(await db.workspaceDocs.get("cv-1")).toMatchObject({ fileName: "Renamed By Agent.cv.json", state: "in-sync" });
        expect(await db.resumes.count()).toBe(1);

        await dir.writeExternal("cvs/Renamed By Agent.cv.json", editFile(text, (doc) => { (doc.basics as Record<string, unknown>).headline = "After the rename"; }));
        await runtime.checkNow();
        await flush();
        expect((await db.resumes.get("cv-1"))?.basics.headline).toBe("After the rename");
    });

    it("never deletes a CV when its file is deleted: it is detached, then back in sync when the file returns", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const text = (await dir.readExternal(FILE))!;
        const cvBefore = JSON.stringify(await db.resumes.get("cv-1"));
        await dir.removeExternal(FILE);
        await runtime.checkNow();
        await flush();
        expect(await db.workspaceDocs.get("cv-1")).toMatchObject({ state: "detached", reason: { code: "file-missing" } });
        expect(JSON.stringify(await db.resumes.get("cv-1"))).toBe(cvBefore);
        expect((await db.workspaceActivity.toArray()).some((row) => row.reason.code === "file-missing")).toBe(true);

        await dir.writeExternal(FILE, text);
        await runtime.checkNow();
        await flush();
        expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("in-sync");
    });

    it("flags two files for one document, applies neither, and recovers when the copy is removed", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const text = (await dir.readExternal(FILE))!;
        const before = JSON.stringify(await db.resumes.get("cv-1"));
        await dir.writeExternal("cvs/Copy.cv.json", editFile(text, (doc) => { (doc.basics as Record<string, unknown>).headline = "From the copy"; }));
        await dir.writeExternal(FILE, editFile(text, (doc) => { (doc.basics as Record<string, unknown>).headline = "From the original"; }));
        await runtime.checkNow();
        await flush();
        expect(await db.workspaceDocs.get("cv-1")).toMatchObject({ state: "blocked", reason: { code: "duplicate-id" } });
        expect(JSON.stringify(await db.resumes.get("cv-1"))).toBe(before);

        await dir.removeExternal("cvs/Copy.cv.json");
        await runtime.checkNow();
        await flush();
        expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("in-sync");
        expect((await db.resumes.get("cv-1"))?.basics.headline).toBe("From the original");
    });

    it("lists a file nobody claims and a sync-tool conflict copy without applying or importing either", async () => {
        const { dir, runtime, attention } = await connected();
        current = runtime;
        const text = (await dir.readExternal(FILE))!;
        await dir.writeExternal("cvs/Stranger.cv.json", editFile(text, (doc) => { doc.id = "someone-else"; }));
        await dir.writeExternal("cvs/Master CV (conflicted copy 2026-11-19).cv.json", editFile(text, (doc) => { (doc.basics as Record<string, unknown>).headline = "From a conflict copy"; }));
        await runtime.checkNow();
        await flush();
        const latest = attention[attention.length - 1];
        expect(latest.unmatched.map((entry) => entry.fileName)).toEqual(["Stranger.cv.json"]);
        expect(latest.conflictCopies.map((copy) => copy.fileName)).toEqual(["Master CV (conflicted copy 2026-11-19).cv.json"]);
        expect(await db.resumes.count()).toBe(1);
        expect((await db.resumes.get("cv-1"))?.basics.headline).not.toBe("From a conflict copy");
        expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("in-sync");
    });

    it("can relink a detached document to another file", async () => {
        const { dir, adapter, runtime } = await connected();
        current = runtime;
        const text = (await dir.readExternal(FILE))!;
        await dir.removeExternal(FILE);
        await runtime.checkNow();
        await flush();
        await dir.writeExternal("cvs/Elsewhere.cv.json", editFile(text, (doc) => { delete doc.id; }));
        await relinkDocument("cv-1", "Elsewhere.cv.json", adapter, "cv");
        runtime.stop();
        const again = createWorkspaceRuntime({ adapter, hideContact: () => false, isVisible: () => true, createSource: quietSource });
        current = again;
        await again.start();
        await again.checkNow();
        await flush();
        expect(await db.workspaceDocs.get("cv-1")).toMatchObject({ fileName: "Elsewhere.cv.json", state: "in-sync" });
    });
});
