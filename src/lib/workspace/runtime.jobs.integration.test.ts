import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addTask, newApplication } from "@/lib/jobs/operations";
import { insertApplication } from "@/lib/jobs/repository";
import { captureSubmission } from "@/lib/jobs/submissions";
import { makeLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";
import { undoActivity } from "./activity";
import { readAppDocuments } from "./apply-stored";
import type { ChangeSource } from "./change-source";
import { createDirectoryAdapter, type DirectoryAdapter } from "./directory-adapter";
import { mirrorDocuments } from "./lifecycle";
import { computeIndex } from "./machine-files";
import { createWorkspaceRuntime, type WorkspaceRuntime } from "./runtime";
import { analyzeFolder, runSetup } from "./setup";
import { syncSubmissionCopies } from "./submission-copies";
import { updateWorkspace } from "./workspace-store";

const STAND_IN = { kind: "directory", name: "w" } as unknown as FileSystemDirectoryHandle;
const JOB_FILE = "applications/Acme - Designer.application.json";
const quietSource = (): ChangeSource => ({ kind: "poll", slow: false, async start() {}, stop() {}, nudge() {}, onVisibilityChange() {} });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const edit = (text: string, change: (doc: Record<string, unknown>) => void) => {
    const doc = JSON.parse(text) as Record<string, unknown>;
    change(doc);
    return `${JSON.stringify(doc, null, 2)}\n`;
};
let counter = 0;
const ctx = () => ({ now: Date.now(), newId: () => `job-id-${++counter}` });

async function connected(options: { includeJobs: boolean }) {
    const dir = createMemoryDirectory("w");
    const adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
    const docs = await readAppDocuments();
    const analysis = await analyzeFolder(adapter, docs, { hideContact: false, now: 1 });
    await runSetup({ adapter, handle: STAND_IN, plan: analysis.plan, appDocs: analysis.appDocs, docs, options: { hideContact: false, now: 1 } });
    await updateWorkspace({ includeJobs: options.includeJobs });
    await mirrorDocuments(adapter, { hideContact: false });
    const runtime = createWorkspaceRuntime({ adapter, hideContact: () => false, isVisible: () => true, createSource: quietSource, machineFiles: false });
    await runtime.start();
    return { dir, adapter, runtime };
}

describe("workspace runtime: tracked jobs", () => {
    let current: WorkspaceRuntime | null = null;
    let jobId = "";
    beforeEach(async () => {
        await resetLetterTables();
        await Promise.all([db.workspace.clear(), db.workspaceDocs.clear(), db.workspaceActivity.clear(), db.jobApplications.clear(), db.jobSubmissionPackets.clear(), db.jobApplicationHistory.clear()]);
        await db.resumes.put(makeWorkspaceCv({ id: "cv-1", title: "Master CV" }));
        await db.coverLetters.put(makeLetter({ id: "l-1", cvId: "cv-1", title: "Acme" }));
        const job = await insertApplication(addTask(newApplication({ company: "Acme", role: "Designer", notesMarkdown: "Ask about remote" }, ctx()), { title: "Send portfolio", dueOn: null }, ctx()));
        jobId = job.id;
    });
    afterEach(() => {
        current?.stop();
        current = null;
    });

    it("writes nothing for jobs until the tracker is included", async () => {
        const { dir, runtime } = await connected({ includeJobs: false });
        current = runtime;
        expect(await dir.readExternal(JOB_FILE)).toBeNull();
        expect(await db.workspaceDocs.get(jobId)).toBeUndefined();
    });

    it("writes one whole-record file per job, without the local revision, and summarises it in the index", async () => {
        const { dir, runtime } = await connected({ includeJobs: true });
        current = runtime;
        const text = (await dir.readExternal(JOB_FILE))!;
        const file = JSON.parse(text);
        expect(file).toMatchObject({ format: "enginecv.application/v1", id: jobId, company: "Acme", stage: "saved", tasks: [{ title: "Send portfolio" }], submissions: [] });
        expect(file.revision).toBeUndefined();
        expect(typeof file.createdAt).toBe("string");
        const index = await computeIndex();
        expect(index.applications).toEqual([expect.objectContaining({ id: jobId, file: JOB_FILE, company: "Acme", stage: "saved", sent: 0 })]);
        // The index never carries notes or contacts.
        expect(JSON.stringify(index)).not.toContain("Ask about remote");
    });

    it("applies an edit from the file with a restore point and a new revision", async () => {
        const { dir, runtime } = await connected({ includeJobs: true });
        current = runtime;
        const before = (await db.jobApplications.get(jobId))!;
        await dir.writeExternal(JOB_FILE, edit((await dir.readExternal(JOB_FILE))!, (doc) => { doc.stage = "applied"; doc.location = "Sarajevo"; }));
        await runtime.checkNow();
        await wait(60);
        const after = (await db.jobApplications.get(jobId))!;
        expect(after).toMatchObject({ stage: "applied", location: "Sarajevo" });
        expect(after.revision).toBeGreaterThan(before.revision);
        const [point] = await db.jobApplicationHistory.toArray();
        expect(point).toMatchObject({ applicationId: jobId, trigger: "file-sync", application: { stage: "saved" } });
    });

    it("undoes a change from the file, keeping a submission recorded since", async () => {
        const { dir, runtime } = await connected({ includeJobs: true });
        current = runtime;
        await dir.writeExternal(JOB_FILE, edit((await dir.readExternal(JOB_FILE))!, (doc) => { doc.stage = "offer"; }));
        await runtime.checkNow();
        await wait(60);
        const activity = (await db.workspaceActivity.toArray()).find((entry) => entry.docId === jobId && entry.kind === "accepted");
        expect(activity?.restoreKind).toBe("application");
        const now = (await db.jobApplications.get(jobId))!;
        await captureSubmission(jobId, now.revision, { sentOn: "2026-11-21", sentAt: null, channel: "email", reference: null, cv: { kind: "none" }, letter: { kind: "none" } });

        expect(await undoActivity(activity!.id!)).toEqual({ ok: true });
        const after = (await db.jobApplications.get(jobId))!;
        expect(after.stage).toBe("saved");
        expect(after.submissions).toHaveLength(1);
        expect(after.revision).toBeGreaterThan(now.revision);
    });

    it("holds a change that removes a task for review, and refuses a cut-off file, changing nothing", async () => {
        const { dir, runtime } = await connected({ includeJobs: true });
        current = runtime;
        const before = (await db.jobApplications.get(jobId))!;
        await dir.writeExternal(JOB_FILE, edit((await dir.readExternal(JOB_FILE))!, (doc) => { doc.tasks = []; }));
        await runtime.checkNow();
        await wait(60);
        expect((await db.workspaceDocs.get(jobId))?.state).toBe("review");
        expect(await db.jobApplications.get(jobId)).toEqual(before);

        const text = (await dir.readExternal(JOB_FILE))!;
        await dir.writeExternal(JOB_FILE, text.slice(0, Math.floor(text.length / 2)));
        await runtime.checkNow();
        await wait(60);
        expect(await db.jobApplications.get(jobId)).toEqual(before);
    });

    it("refuses a file that leaves out a required list", async () => {
        const { dir, runtime } = await connected({ includeJobs: true });
        current = runtime;
        const before = (await db.jobApplications.get(jobId))!;
        await dir.writeExternal(JOB_FILE, edit((await dir.readExternal(JOB_FILE))!, (doc) => { delete doc.events; }));
        await runtime.checkNow();
        await wait(60);
        expect((await db.workspaceDocs.get(jobId))?.state).toBe("blocked");
        expect(await db.jobApplications.get(jobId)).toEqual(before);
    });

    it("never lets a file change a recorded copy's reference", async () => {
        const captured = await captureSubmission(jobId, (await db.jobApplications.get(jobId))!.revision, { sentOn: "2026-11-20", sentAt: null, channel: "email", reference: null, cv: { kind: "document", id: "cv-1" }, letter: { kind: "none" } });
        const { dir, runtime } = await connected({ includeJobs: true });
        current = runtime;
        const original = captured.submissions[0];
        await dir.writeExternal(JOB_FILE, edit((await dir.readExternal(JOB_FILE))!, (doc) => {
            const [submission] = doc.submissions as Array<Record<string, unknown>>;
            submission.packetSha256 = "0".repeat(64);
            submission.reference = "REF-1";
        }));
        await runtime.checkNow();
        await wait(60);
        const [after] = (await db.jobApplications.get(jobId))!.submissions;
        expect(after.reference).toBe("REF-1");
        expect(after.packetSha256).toBe(original.packetSha256);
        expect(after.cv).toEqual(original.cv);
    });

    it("imports a new job file that names a new id, and follows a rename", async () => {
        const { dir, runtime } = await connected({ includeJobs: true });
        current = runtime;
        const copy = edit((await dir.readExternal(JOB_FILE))!, (doc) => { doc.id = "job-from-agent"; doc.company = "Globex"; });
        await dir.writeExternal("applications/Globex - Designer.application.json", copy);
        await dir.writeExternal("applications/renamed.application.json", (await dir.readExternal(JOB_FILE))!);
        await dir.removeExternal(JOB_FILE);
        await runtime.checkNow();
        await wait(60);
        expect((await db.jobApplications.get("job-from-agent"))?.company).toBe("Globex");
        expect((await db.workspaceDocs.get(jobId))?.fileName).toBe("renamed.application.json");
        expect((await db.jobApplications.get(jobId))?.company).toBe("Acme");
    });

    it("drops job rows when the tracker is left out, keeping the files and not ignoring them", async () => {
        const { adapter, dir, runtime } = await connected({ includeJobs: true });
        runtime.stop();
        await updateWorkspace({ includeJobs: false });
        await mirrorDocuments(adapter, { hideContact: false });
        expect(await db.workspaceDocs.get(jobId)).toBeUndefined();
        expect(await dir.readExternal(JOB_FILE)).not.toBeNull();
        expect((await db.workspace.get("current"))?.ignoredFiles ?? []).not.toContain("Acme - Designer.application.json");
    });
});

describe("recorded copies in submissions/", () => {
    let adapter: DirectoryAdapter;
    let dir: ReturnType<typeof createMemoryDirectory>;
    let jobId = "";
    beforeEach(async () => {
        await resetLetterTables();
        await Promise.all([db.jobApplications.clear(), db.jobSubmissionPackets.clear()]);
        await db.resumes.put(makeWorkspaceCv({ id: "cv-1", title: "Master CV" }));
        dir = createMemoryDirectory("w");
        adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
        const job = await insertApplication(newApplication({ company: "Acme", role: "Designer" }, ctx()));
        await captureSubmission(job.id, job.revision, { sentOn: "2026-11-20", sentAt: null, channel: "email", reference: null, cv: { kind: "document", id: "cv-1" }, letter: { kind: "none" } });
        jobId = job.id;
    });

    it("writes each copy once, exactly, and never replaces a file with other bytes", async () => {
        const [packet] = await db.jobSubmissionPackets.toArray();
        expect(await syncSubmissionCopies(adapter, { write: true })).toMatchObject({ written: 1, conflicts: [] });
        expect(await dir.readExternal(`submissions/${packet.id}.submission.json`)).toBe(packet.text);
        expect(await syncSubmissionCopies(adapter, { write: true })).toMatchObject({ written: 0, conflicts: [] });

        await dir.writeExternal(`submissions/${packet.id}.submission.json`, packet.text.replace("Master", "Other"));
        expect((await syncSubmissionCopies(adapter, { write: true })).conflicts).toEqual([packet.id]);
        expect(await dir.readExternal(`submissions/${packet.id}.submission.json`)).toContain("Other");
    });

    it("writes nothing unless asked, and imports a missing copy only when it checks out", async () => {
        const [packet] = await db.jobSubmissionPackets.toArray();
        expect(await syncSubmissionCopies(adapter, { write: false })).toMatchObject({ written: 0 });
        expect(await dir.readExternal(`submissions/${packet.id}.submission.json`)).toBeNull();

        await dir.writeExternal(`submissions/${packet.id}.submission.json`, packet.text.replace("Master", "Forged"));
        await db.jobSubmissionPackets.clear();
        expect(await syncSubmissionCopies(adapter, { write: false })).toMatchObject({ imported: 0, conflicts: [packet.id] });
        expect(await db.jobSubmissionPackets.count()).toBe(0);

        await dir.writeExternal(`submissions/${packet.id}.submission.json`, packet.text);
        expect(await syncSubmissionCopies(adapter, { write: false })).toMatchObject({ imported: 1 });
        expect(await db.jobSubmissionPackets.get(packet.id)).toEqual(packet);
        expect((await db.jobApplications.get(jobId))?.submissions[0].packetId).toBe(packet.id);
    });

    it("counts copies no job refers to without importing them", async () => {
        await dir.writeExternal("submissions/stranger.submission.json", "{}");
        expect(await syncSubmissionCopies(adapter, { write: true })).toMatchObject({ unreferenced: 1 });
        expect(await db.jobSubmissionPackets.get("stranger")).toBeUndefined();
    });
});
