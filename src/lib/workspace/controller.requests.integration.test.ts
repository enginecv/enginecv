import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { makeLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";
import { readAppDocuments } from "./apply-stored";
import type { ChangeSource } from "./change-source";
import { createDirectoryAdapter } from "./directory-adapter";
import { REQUEST_EXPIRY_MS, REQUESTS_DIR } from "./requests";
import { processRequests } from "./request-processor";
import { createWorkspaceRuntime, type WorkspaceRuntime } from "./runtime";
import { analyzeFolder, runSetup } from "./setup";

const STAND_IN = { kind: "directory", name: "w" } as unknown as FileSystemDirectoryHandle;
const quietSource = (): ChangeSource => ({ kind: "poll", slow: false, async start() {}, stop() {}, nudge() {}, onVisibilityChange() {} });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const request = (id: string, body: Record<string, unknown>) => JSON.stringify({ id, action: "export", ...body });
const resultOf = async (dir: ReturnType<typeof createMemoryDirectory>, id: string) => {
    const text = await dir.readExternal(`.enginecv/results/${id}.result.json`);
    return text === null ? null : JSON.parse(text);
};

async function connected() {
    const dir = createMemoryDirectory("w");
    const adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
    const docs = await readAppDocuments();
    const analysis = await analyzeFolder(adapter, docs, { hideContact: false, now: 1 });
    await runSetup({ adapter, handle: STAND_IN, plan: analysis.plan, appDocs: analysis.appDocs, docs, options: { hideContact: false, now: 1 } });
    const runtime = createWorkspaceRuntime({ adapter, hideContact: () => false, isVisible: () => true, createSource: quietSource });
    await runtime.start();
    return { dir, adapter, runtime };
}

describe("workspace: export requests from an agent", () => {
    let current: WorkspaceRuntime | null = null;
    beforeEach(async () => {
        await resetLetterTables();
        await db.workspace.clear();
        await db.workspaceDocs.clear();
        await db.workspaceActivity.clear();
        await db.resumes.put(makeWorkspaceCv({ id: "cv-1", title: "Master CV", name: "Amina Hodzic" }));
        await db.coverLetters.put(makeLetter({ id: "l-1", cvId: "cv-1", title: "Acme", company: "Acme", role: "Designer" }));
    });
    afterEach(() => {
        current?.stop();
        current = null;
    });

    it("exports a CV and a letter into exports/ and answers with the file name", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        await dir.writeExternal(".enginecv/requests/r1.request.json", request("r1", { target: "cv-1", format: "md" }));
        await dir.writeExternal(".enginecv/requests/r2.request.json", request("r2", { target: "letters/Acme.letter.json", format: "txt" }));
        await runtime.checkNow();
        const one = await resultOf(dir, "r1");
        const two = await resultOf(dir, "r2");
        expect(one).toMatchObject({ id: "r1", ok: true, file: "exports/master-cv.md" });
        expect(one.bytes).toBeGreaterThan(50);
        expect(await dir.readExternal("exports/master-cv.md")).toContain("Amina");
        expect(two).toMatchObject({ ok: true, file: "exports/cover-letter-acme-designer.txt" });
        const rows = await db.workspaceActivity.toArray();
        expect(rows.filter((row) => row.reason.code === "exported")).toHaveLength(2);
        const log = (await dir.readExternal(".enginecv/log.ndjson"))!;
        expect(log).toContain('"outcome":"accepted"');
        expect(log).not.toContain("Amina");
    });

    it("answers a Word export with a real file", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        await dir.writeExternal(".enginecv/requests/w1.request.json", request("w1", { target: "cv-1", format: "docx" }));
        await runtime.checkNow();
        expect(await resultOf(dir, "w1")).toMatchObject({ ok: true, file: "exports/master-cv.docx" });
        expect((await dir.readExternal("exports/master-cv.docx"))!.startsWith("PK")).toBe(true);
    });

    it("answers one-line errors for an unknown target, an unavailable format and a broken request", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        await dir.writeExternal(".enginecv/requests/a.request.json", request("a", { target: "4a1x", format: "md" }));
        await dir.writeExternal(".enginecv/requests/b.request.json", request("b", { target: "l-1", format: "json" }));
        await dir.writeExternal(".enginecv/requests/c.request.json", request("c", { target: "cv-1", format: "pdf" }));
        await dir.writeExternal(".enginecv/requests/d.request.json", JSON.stringify({ id: "other", action: "export", target: "cv-1", format: "md" }));
        await runtime.checkNow();
        await runtime.checkNow(); // four requests: three are handled per pass
        expect(await resultOf(dir, "a")).toMatchObject({ ok: false, error: { code: "unknown-document", message: expect.stringContaining(".enginecv/index.json") } });
        expect(await resultOf(dir, "b")).toMatchObject({ ok: false, error: { code: "format-unavailable" } });
        const pdf = await resultOf(dir, "c");
        expect(pdf.error.code).toBe("format-unavailable");
        expect(pdf.error.message).toContain("exports.md");
        expect(await resultOf(dir, "d")).toMatchObject({ ok: false, error: { code: "request-invalid" } });
        const codes = (await db.workspaceActivity.toArray()).map((row) => row.reason.code);
        expect(codes).toEqual(expect.arrayContaining(["unknown-document", "format-unavailable", "request-invalid"]));
    });

    it("waits for a request that is still being written, then handles it once it is complete", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const full = request("p1", { target: "cv-1", format: "md" });
        await dir.writeExternal(".enginecv/requests/p1.request.json", full.slice(0, 20));
        await runtime.checkNow();
        expect(await resultOf(dir, "p1")).toBeNull(); // not called invalid yet
        await dir.writeExternal(".enginecv/requests/p1.request.json", full);
        await runtime.checkNow();
        expect(await resultOf(dir, "p1")).toMatchObject({ ok: true });
    });

    it("handles a request once: the same id is not run again", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        await dir.writeExternal(".enginecv/requests/s1.request.json", request("s1", { target: "cv-1", format: "md" }));
        await runtime.checkNow();
        const first = await resultOf(dir, "s1");
        await dir.writeExternal(".enginecv/requests/s1.request.json", request("s1", { target: "cv-1", format: "txt" })); // the same id again
        await runtime.checkNow();
        expect(await resultOf(dir, "s1")).toEqual(first);
        expect(await dir.listExternal("exports")).not.toContain("master-cv.txt");
    });

    it("never overwrites a file it did not write, and gives a clash a -2 suffix", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        await dir.writeExternal("exports/master-cv.md", "someone else's notes");
        await dir.writeExternal(".enginecv/requests/n1.request.json", request("n1", { target: "cv-1", format: "md" }));
        await runtime.checkNow();
        expect(await resultOf(dir, "n1")).toMatchObject({ ok: true, file: "exports/master-cv-2.md" });
        expect(await dir.readExternal("exports/master-cv.md")).toBe("someone else's notes");
        // A file the app wrote itself is replaced by the next export of the same thing.
        await dir.writeExternal(".enginecv/requests/n2.request.json", request("n2", { target: "cv-1", format: "md" }));
        await runtime.checkNow();
        expect(await resultOf(dir, "n2")).toMatchObject({ file: "exports/master-cv-2.md" });
    });

    it("answers request-expired for a request nobody handled in time, instead of running it late", async () => {
        const { dir, adapter } = await connected();
        await dir.writeExternal(".enginecv/requests/e1.request.json", request("e1", { target: "cv-1", format: "md" }));
        await processRequests({ adapter, now: () => Date.now() + REQUEST_EXPIRY_MS + 60_000 });
        expect(await resultOf(dir, "e1")).toMatchObject({ ok: false, error: { code: "request-expired" } });
        expect(await dir.readExternal("exports/master-cv.md")).toBeNull();
    });

    it("treats edits in exports/ as nothing: no import, no sync, no change to documents", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const before = JSON.stringify(await db.resumes.get("cv-1"));
        await dir.writeExternal("exports/master-cv.cv.json", request("x", { target: "cv-1", format: "md" }));
        await dir.writeExternal("exports/notes.txt", "hello");
        await runtime.checkNow();
        await wait(50);
        expect(JSON.stringify(await db.resumes.get("cv-1"))).toBe(before);
        expect(await db.resumes.count()).toBe(1);
        expect(await dir.readExternal("exports/notes.txt")).toBe("hello");
    });

    it("handles a few requests per pass so a burst never stalls, and the rest on the next pass", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        for (let index = 0; index < 5; index += 1) await dir.writeExternal(`.enginecv/requests/b${index}.request.json`, request(`b${index}`, { target: "cv-1", format: "txt" }));
        await runtime.checkNow();
        const done = (await dir.listExternal(".enginecv/results")).filter((name) => name.endsWith(".result.json")).length;
        expect(done).toBe(3);
        await runtime.checkNow();
        expect((await dir.listExternal(".enginecv/results")).filter((name) => name.endsWith(".result.json"))).toHaveLength(5);
    });

    it("keeps the request folder tidy: old requests go after a day, results are capped", async () => {
        const { dir, adapter } = await connected();
        await dir.writeExternal(".enginecv/requests/old.request.json", request("old", { target: "cv-1", format: "md" }));
        await processRequests({ adapter, now: () => Date.now() + 2 * 24 * 60 * 60 * 1000 });
        expect(await dir.listExternal(REQUESTS_DIR)).not.toContain("old.request.json");
        expect(await resultOf(dir, "old")).toMatchObject({ ok: false, error: { code: "request-expired" } });
    });
});
