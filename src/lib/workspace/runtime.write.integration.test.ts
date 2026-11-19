import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { loadResumeHistory } from "@/lib/history";
import { useResumeStore } from "@/lib/store";
import { resetLetterTables } from "../../../test/setup/letter-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { editFile, makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";
import { readAppDocuments } from "./apply-stored";
import type { ChangeSource } from "./change-source";
import { createDirectoryAdapter } from "./directory-adapter";
import { createWorkspaceRuntime, type WorkspaceRuntime } from "./runtime";
import { analyzeFolder, runSetup } from "./setup";

const STAND_IN = { kind: "directory", name: "w" } as unknown as FileSystemDirectoryHandle;
const FILE = "cvs/Master CV.cv.json";
const quietSource = (): ChangeSource => ({ kind: "poll", slow: false, async start() {}, stop() {}, nudge() {}, onVisibilityChange() {} });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const headlineOf = (text: string | null) => (text ? JSON.parse(text).basics?.headline : undefined);

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

async function editInApp(headline: string) {
    const stored = (await db.resumes.get("cv-1"))!;
    await db.resumes.put({ ...stored, basics: { ...stored.basics, headline }, updatedAt: stored.updatedAt + 1 });
}

describe("workspace runtime: writing the app's changes to files", () => {
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

    it("writes a change made to a closed CV once typing stops, as one whole file", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        await editInApp("First");
        await editInApp("Second");
        await editInApp("Third");
        await wait(1300);
        expect(headlineOf(await dir.readExternal(FILE))).toBe("Third");
        expect((await dir.listExternal("cvs")).filter((name) => name.endsWith(".crswap"))).toEqual([]);
        expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("in-sync");
    });

    it("does not write the same thing again (no echo loop)", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        await editInApp("Once");
        await wait(1300);
        const stamp = (await dir.root.getDirectoryHandle("cvs").then((d) => d.getFileHandle("Master CV.cv.json")).then((h) => h.getFile())).lastModified;
        await runtime.checkNow();
        await wait(1000);
        const after = (await dir.root.getDirectoryHandle("cvs").then((d) => d.getFileHandle("Master CV.cv.json")).then((h) => h.getFile())).lastModified;
        expect(after).toBe(stamp);
    });

    it("takes a newer outside change first instead of overwriting it", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const text = (await dir.readExternal(FILE))!;
        await dir.writeExternal(FILE, editFile(text, (doc) => { (doc.basics as Record<string, unknown>).headline = "From outside"; }));
        await editInApp("From the app");
        await wait(1500);
        // Both versions stay recoverable: the file now holds one, and the other is a restore point.
        const fileHeadline = headlineOf(await dir.readExternal(FILE));
        const appHeadline = (await db.resumes.get("cv-1"))?.basics.headline;
        expect(fileHeadline).toBe(appHeadline);
        const history = await loadResumeHistory("cv-1");
        const seen = [fileHeadline, ...history.map((entry) => (JSON.parse(entry.resumeJson) as { basics: { headline: string } }).basics.headline)];
        expect(seen).toContain("From outside");
        expect(seen).toContain("From the app");
    });

    it("never writes over a blocked file", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        await dir.writeExternal(FILE, "{ half a fi");
        await runtime.checkNow();
        await wait(50);
        await editInApp("Typed meanwhile");
        await wait(1300);
        expect(await dir.readExternal(FILE)).toBe("{ half a fi");
        expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("blocked");
    });

    it("never recreates a file for a detached document", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        await dir.removeExternal(FILE);
        await runtime.checkNow();
        await wait(50);
        await editInApp("Typed with no file");
        await wait(1300);
        expect((await dir.listExternal("cvs")).filter((name) => name.endsWith(".json"))).toEqual([]);
        expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("detached");
    });

    it("shows busy while another program holds the file, retries with back-off, and writes when it frees", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        dir.failNext("Master CV.cv.json", "write", "NoModificationAllowedError", 1);
        await editInApp("After busy");
        await wait(1100);
        expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("busy");
        await wait(2500); // the retry waits its back-off, then the usual typing pause
        expect(headlineOf(await dir.readExternal(FILE))).toBe("After busy");
        expect((await db.workspaceDocs.get("cv-1"))?.state).toBe("in-sync");
    }, 15_000);
});
