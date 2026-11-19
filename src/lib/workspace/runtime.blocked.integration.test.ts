import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { loadResumeHistory } from "@/lib/history";
import { useResumeStore } from "@/lib/store";
import { resetLetterTables } from "../../../test/setup/letter-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { MANGLES, cutOff, editFile, makeWorkspaceCv, withoutSection } from "../../../test/setup/workspace-fixtures";
import { readAppDocuments } from "./apply-stored";
import type { ChangeSource } from "./change-source";
import { createDirectoryAdapter } from "./directory-adapter";
import { createWorkspaceRuntime, type WorkspaceRuntime } from "./runtime";
import { analyzeFolder, runSetup } from "./setup";

const STAND_IN = { kind: "directory", name: "w" } as unknown as FileSystemDirectoryHandle;
const FILE = "cvs/Master CV.cv.json";
const quietSource = (): ChangeSource => ({ kind: "poll", slow: false, async start() {}, stop() {}, nudge() {}, onVisibilityChange() {} });
/** Sections an agent might drop in one go; together they are well over half of the QA CV's entries. */
const GUT = ["experience", "education", "projects", "courses", "certificates", "organisations", "awards", "publications", "references", "custom", "skills", "languages"];
const flush = () => new Promise((resolve) => setTimeout(resolve, 30));

async function connected() {
    const dir = createMemoryDirectory("w");
    const adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
    const docs = await readAppDocuments();
    const analysis = await analyzeFolder(adapter, docs, { hideContact: false, now: 1 });
    await runSetup({ adapter, handle: STAND_IN, plan: analysis.plan, appDocs: analysis.appDocs, docs, options: { hideContact: false, now: 1 } });
    const runtime = createWorkspaceRuntime({ adapter, hideContact: () => false, isVisible: () => true, createSource: quietSource });
    await runtime.start();
    return { dir, runtime };
}

describe("workspace runtime: files that must not harm", () => {
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

    it("never applies a cut-off file, marks it blocked with a reason, and leaves the file alone", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const before = JSON.stringify(await db.resumes.get("cv-1"));
        const good = (await dir.readExternal(FILE))!;
        for (const fraction of [0.05, 0.3, 0.5, 0.8, 0.97]) {
            const broken = cutOff(good, fraction);
            await dir.writeExternal(FILE, broken);
            await runtime.checkNow();
            await flush();
            expect(JSON.stringify(await db.resumes.get("cv-1"))).toBe(before);
            expect(await dir.readExternal(FILE)).toBe(broken); // not overwritten by the app
            expect(await db.workspaceDocs.get("cv-1")).toMatchObject({ state: "blocked", reason: { code: expect.stringMatching(/invalid-json|no-document/) } });
        }
        const note = JSON.parse((await dir.readExternal(".enginecv/results/cv-1.refused.json"))!);
        expect(note).toMatchObject({ doc: "cv-1", refused: true, file: "cvs/Master CV.cv.json" });
        const lines = (await dir.readExternal(".enginecv/log.ndjson"))!.trim().split("\n").map((line) => JSON.parse(line));
        expect(lines.some((line) => line.outcome === "refused" && line.doc === "cv-1")).toBe(true);
        expect((await db.workspaceActivity.toArray()).some((row) => row.kind === "refused")).toBe(true);
    });

    it("clears the blocked state and the refusal note when a corrected file is saved", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const good = (await dir.readExternal(FILE))!;
        await dir.writeExternal(FILE, cutOff(good, 0.5));
        await runtime.checkNow();
        await flush();
        expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("blocked");

        const fixed = editFile(good, (doc) => {
            (doc.basics as Record<string, unknown>).headline = "Fixed and changed";
        });
        await dir.writeExternal(FILE, fixed);
        await runtime.checkNow();
        await flush();
        expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("in-sync");
        expect((await db.resumes.get("cv-1"))?.basics.headline).toBe("Fixed and changed");
        expect(await dir.readExternal(".enginecv/results/cv-1.refused.json")).toBeNull();
    });

    it("blocks empty, malformed and oversized files with distinct reasons", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const cases: Array<[string, string]> = [["", "empty"], ["{ not json", "invalid-json"], ["x".repeat(210 * 1024), "too-large"], ["{}", "no-document"]];
        for (const [text, code] of cases) {
            await dir.writeExternal(FILE, text);
            await runtime.checkNow();
            await flush();
            expect((await db.workspaceDocs.get("cv-1"))?.reason?.code, code).toBe(code);
            const note = JSON.parse((await dir.readExternal(".enginecv/results/cv-1.refused.json"))!);
            expect(note.code).toBe(code);
            expect(JSON.stringify(note)).not.toContain("not json");
        }
    });

    it("accepts harmless slips and keeps the content", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const good = (await dir.readExternal(FILE))!;
        let n = 0;
        for (const mangle of Object.values(MANGLES)) {
            n += 1;
            const edited = mangle(editFile(good, (doc) => { (doc.basics as Record<string, unknown>).headline = `Slip ${n}`; }));
            await dir.writeExternal(FILE, edited);
            await runtime.checkNow();
            await flush();
            expect((await db.resumes.get("cv-1"))?.basics.headline, `slip ${n}`).toBe(`Slip ${n}`);
            expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("in-sync");
        }
    });

    it("holds a file that drops many entries for review and leaves the CV and the file as they are", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const before = JSON.stringify(await db.resumes.get("cv-1"));
        const gutted = GUT.reduce((text, section) => withoutSection(text, section), (await dir.readExternal(FILE))!);
        await dir.writeExternal(FILE, gutted);
        await runtime.checkNow();
        await flush();

        const row = (await db.workspaceDocs.get("cv-1"))!;
        expect(row.state).toBe("review");
        expect(row.reason?.code).toBe("shrink-guard");
        expect(row.pendingReview?.removed.length).toBeGreaterThan(0);
        expect(row.pendingReview?.removed.length).toBeLessThanOrEqual(10);
        expect(JSON.stringify(await db.resumes.get("cv-1"))).toBe(before);
        expect(await dir.readExternal(FILE)).toBe(gutted);
        // The same file is not judged again on every check, and the log never names the removed entries.
        await runtime.checkNow();
        await runtime.checkNow();
        expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("review");
        const log = (await dir.readExternal(".enginecv/log.ndjson"))!;
        for (const title of row.pendingReview!.removed) expect(log).not.toContain(title);
        expect(JSON.parse((await dir.readExternal(".enginecv/results/cv-1.refused.json"))!).code).toBe("shrink-guard");
    });

    it("does not write the app's version over a file waiting for review", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const gutted = GUT.reduce((text, section) => withoutSection(text, section), (await dir.readExternal(FILE))!);
        await dir.writeExternal(FILE, gutted);
        await runtime.checkNow();
        await flush();
        const row = (await db.resumes.get("cv-1"))!;
        const engine = runtime.engineFor("cv-1")!;
        useResumeStore.setState({ activeResumeId: "cv-1", resume: { ...row, basics: { ...row.basics, headline: "Typed during review" }, updatedAt: row.updatedAt + 1 }, isDirty: false });
        engine.notifyLocalChange();
        await new Promise((resolve) => setTimeout(resolve, 1000));
        expect(await dir.readExternal(FILE)).toBe(gutted);
    });

    it("applies the held change after confirmation, with a restore point first", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const gutted = GUT.reduce((text, section) => withoutSection(text, section), (await dir.readExternal(FILE))!);
        await dir.writeExternal(FILE, gutted);
        await runtime.checkNow();
        await flush();
        await runtime.applyHeld("cv-1");
        await flush();
        const after = (await db.resumes.get("cv-1"))!;
        expect(after.experience).toEqual([]);
        expect(after.education).toEqual([]);
        expect(after.skillGroups.flatMap((group) => group.skills)).toEqual([]);
        expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("in-sync");
        expect((await loadResumeHistory("cv-1"))[0].trigger).toBe("file-sync");
        expect(await dir.readExternal(".enginecv/results/cv-1.refused.json")).toBeNull();
        const accepted = (await db.workspaceActivity.toArray()).find((row) => row.kind === "accepted");
        expect(accepted?.restoreKind).toBe("cv");
        expect(accepted?.restoreId).not.toBeNull();
    });

    it("keeps the app's version when asked, writing it over the file", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const original = (await dir.readExternal(FILE))!;
        const gutted = GUT.reduce((text, section) => withoutSection(text, section), original);
        await dir.writeExternal(FILE, gutted);
        await runtime.checkNow();
        await flush();
        await runtime.keepMine("cv-1");
        await flush();
        expect((await db.resumes.get("cv-1"))?.experience.length).toBeGreaterThan(0);
        expect(JSON.parse((await dir.readExternal(FILE))!).experience.length).toBeGreaterThan(0);
        expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("in-sync");
    });

    it("applies a removal just inside the threshold without asking", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const trimmed = editFile((await dir.readExternal(FILE))!, (doc) => {
            (doc.experience as unknown[]).pop();
        });
        await dir.writeExternal(FILE, trimmed);
        await runtime.checkNow();
        await flush();
        expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("in-sync");
    });
});
