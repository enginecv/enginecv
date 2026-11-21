import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { loadResumeHistory } from "@/lib/history";
import { useResumeStore } from "@/lib/store";
import { makeLetter, makeSentLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { MANGLES, cutOff, editFile, makeWorkspaceCv, withoutSection } from "../../../test/setup/workspace-fixtures";
import { BROWSER_TOOLS_KEY, browserTools, detectModelContext, setBrowserToolsEnabled, syncBrowserTools, type ModelContextLike, type ModelContextTool } from "./browser-tools";
import { createDirectoryAdapter, type DirectoryAdapter } from "./directory-adapter";

function fakeContext() {
    const tools = new Map<string, ModelContextTool>();
    const context: ModelContextLike = {
        registerTool: (tool) => { tools.set(tool.name, tool); },
        unregisterTool: (name) => { tools.delete(name); },
    };
    return { context, tools };
}
const noFolder: { getAdapter: () => DirectoryAdapter | null } = { getAdapter: () => null };
const call = async (name: string, input: Record<string, unknown>, deps = noFolder) => (await browserTools(deps).find((tool) => tool.name === name)!.execute(input)) as Record<string, unknown>;
const GUT = ["experience", "education", "projects", "courses", "certificates", "organisations", "awards", "publications", "references", "custom", "skills", "languages"];

describe("browser tools: registration", () => {
    beforeEach(() => {
        localStorage.removeItem(BROWSER_TOOLS_KEY);
        syncBrowserTools(noFolder, null); // clear any earlier registration
    });
    afterEach(() => {
        localStorage.removeItem(BROWSER_TOOLS_KEY);
        syncBrowserTools(noFolder, null);
    });

    it("does nothing where the browser has no such API", () => {
        setBrowserToolsEnabled(true);
        expect(detectModelContext()).toBeNull();
        expect(syncBrowserTools(noFolder)).toBe(false);
    });

    it("does nothing while the person has not turned it on, even where supported", () => {
        const { context, tools } = fakeContext();
        expect(syncBrowserTools(noFolder, context)).toBe(false);
        expect(tools.size).toBe(0);
    });

    it("registers the four tools when supported and on, and removes them when turned off", () => {
        const { context, tools } = fakeContext();
        setBrowserToolsEnabled(true);
        expect(syncBrowserTools(noFolder, context)).toBe(true);
        expect([...tools.keys()].sort()).toEqual(["apply_change", "list_documents", "read_document", "request_export"]);
        expect(syncBrowserTools(noFolder, context)).toBe(true); // again: no duplicates
        expect(tools.size).toBe(4);
        setBrowserToolsEnabled(false);
        expect(syncBrowserTools(noFolder, context)).toBe(false);
        expect(tools.size).toBe(0);
    });

    it("finds the API on document.modelContext first, then navigator.modelContext", () => {
        const onNavigator = fakeContext();
        (navigator as unknown as { modelContext?: ModelContextLike }).modelContext = onNavigator.context;
        expect(detectModelContext()).toBe(onNavigator.context);
        const onDocument = fakeContext();
        (document as unknown as { modelContext?: ModelContextLike }).modelContext = onDocument.context;
        expect(detectModelContext()).toBe(onDocument.context);
        delete (document as unknown as { modelContext?: ModelContextLike }).modelContext;
        delete (navigator as unknown as { modelContext?: ModelContextLike }).modelContext;
        expect(detectModelContext()).toBeNull();
    });

    it("never lets a failing or changing API break the app", () => {
        setBrowserToolsEnabled(true);
        const broken: ModelContextLike = { registerTool: () => { throw new Error("API changed"); } };
        expect(syncBrowserTools(noFolder, broken)).toBe(false);
    });

    it("describes every tool with a schema, and is off by default", () => {
        expect(localStorage.getItem(BROWSER_TOOLS_KEY)).toBeNull();
        for (const tool of browserTools(noFolder)) {
            expect(tool.description.length).toBeGreaterThan(20);
            expect(tool.inputSchema).toMatchObject({ type: "object" });
        }
    });
});

describe("browser tools: the same checks as a file change", () => {
    beforeEach(async () => {
        await resetLetterTables();
        await db.workspace.clear();
        await db.workspaceDocs.clear();
        await db.workspaceActivity.clear();
        await db.resumeHistory.clear();
        await db.letterHistory.clear();
        useResumeStore.setState({ activeResumeId: null, isDirty: false });
        await db.resumes.put(makeWorkspaceCv({ id: "cv-1", title: "Master CV", name: "Amina Hodzic" }));
        await db.coverLetters.put(makeLetter({ id: "l-1", cvId: "cv-1", title: "Acme", company: "Acme", role: "Designer" }));
        await db.coverLetters.put(makeSentLetter({ id: "l-sent", cvId: "cv-1", title: "Sent one" }));
    });

    it("lists documents with ids and sizes but no document text", async () => {
        const result = await call("list_documents", {});
        const text = JSON.stringify(result);
        expect(result.ok).toBe(true);
        expect((result.cvs as Array<{ id: string }>).map((cv) => cv.id)).toEqual(["cv-1"]);
        expect((result.letters as Array<{ id: string }>).map((letter) => letter.id).sort()).toEqual(["l-1", "l-sent"]);
        expect(text).not.toContain("excited"); // a paragraph's words are not in the list
    });

    it("reads a whole document, or one section of a CV to save tokens", async () => {
        const whole = await call("read_document", { id: "cv-1" });
        expect(JSON.parse(whole.content as string).basics.name).toBe("Amina Hodzic");
        const part = await call("read_document", { id: "cv-1", section: "basics" });
        expect(JSON.parse(part.content as string).name).toBe("Amina Hodzic");
        expect((part.content as string).length).toBeLessThan((whole.content as string).length);
        expect(await call("read_document", { id: "cv-1", section: "nonsense" })).toMatchObject({ ok: false, code: "request-invalid" });
        expect(await call("read_document", { id: "nope" })).toMatchObject({ ok: false, code: "unknown-document" });
        const letter = await call("read_document", { id: "l-1" });
        expect(JSON.parse(letter.content as string)).toMatchObject({ format: "enginecv.letter/v1", id: "l-1" });
    });

    it("applies a valid change with a restore point and an activity entry", async () => {
        const text = (await call("read_document", { id: "cv-1" })).content as string;
        const content = editFile(text, (doc) => { (doc.basics as Record<string, unknown>).headline = "Set by an assistant"; });
        const result = await call("apply_change", { id: "cv-1", content });
        expect(result).toMatchObject({ ok: true, changed: true });
        expect((await db.resumes.get("cv-1"))?.basics.headline).toBe("Set by an assistant");
        expect((await loadResumeHistory("cv-1"))[0].trigger).toBe("file-sync");
        const accepted = (await db.workspaceActivity.toArray()).find((row) => row.kind === "accepted");
        expect(accepted).toMatchObject({ docId: "cv-1", restoreKind: "cv" });
        expect(accepted?.restoreId).not.toBeNull();
        expect(await call("apply_change", { id: "cv-1", content })).toMatchObject({ ok: true, changed: false }); // the same again: nothing to do
    });

    it("refuses what a file would be refused: empty, cut off, not JSON, and a drop of most entries", async () => {
        const before = JSON.stringify(await db.resumes.get("cv-1"));
        const text = (await call("read_document", { id: "cv-1" })).content as string;
        for (const content of ["", cutOff(text, 0.5), "{ not json", "{}"]) {
            expect(await call("apply_change", { id: "cv-1", content })).toMatchObject({ ok: false });
        }
        const gutted = await call("apply_change", { id: "cv-1", content: GUT.reduce((acc, section) => withoutSection(acc, section), text) });
        expect(gutted).toMatchObject({ ok: false, code: "shrink-guard" });
        expect(String(gutted.message)).toContain("Nothing was changed");
        expect(JSON.stringify(await db.resumes.get("cv-1"))).toBe(before);
        const rows = await db.workspaceActivity.toArray();
        expect(rows.some((row) => row.kind === "review" && row.reason.code === "shrink-guard")).toBe(true);
        expect(rows.some((row) => row.kind === "refused")).toBe(true);
        expect(JSON.stringify(rows)).not.toContain("Amina Hodzic"); // codes and counts only
    });

    it("repairs the harmless slips like a file does", async () => {
        const text = (await call("read_document", { id: "cv-1" })).content as string;
        const content = MANGLES.fenced(editFile(text, (doc) => { (doc.basics as Record<string, unknown>).headline = "Through a code fence"; }));
        expect(await call("apply_change", { id: "cv-1", content })).toMatchObject({ ok: true, changed: true });
        expect((await db.resumes.get("cv-1"))?.basics.headline).toBe("Through a code fence");
    });

    it("changes a draft letter, and refuses a sent one", async () => {
        const letterText = (await call("read_document", { id: "l-1" })).content as string;
        const content = editFile(letterText, (doc) => { doc.subject = "From an assistant"; });
        expect(await call("apply_change", { id: "l-1", content })).toMatchObject({ ok: true, changed: true });
        expect((await db.coverLetters.get("l-1"))?.subject).toBe("From an assistant");

        const sentText = (await call("read_document", { id: "l-sent" })).content as string;
        const before = JSON.stringify(await db.coverLetters.get("l-sent"));
        expect(await call("apply_change", { id: "l-sent", content: editFile(sentText, (doc) => { doc.subject = "Too late"; }) })).toMatchObject({ ok: false, code: "sent-letter" });
        expect(JSON.stringify(await db.coverLetters.get("l-sent"))).toBe(before);
    });

    it("changes a CV that is open in the editor through the editor, so its own save cannot undo it", async () => {
        const open = (await db.resumes.get("cv-1"))!;
        useResumeStore.setState({ activeResumeId: "cv-1", resume: open as never, isDirty: false });
        const text = (await call("read_document", { id: "cv-1" })).content as string;
        const result = await call("apply_change", { id: "cv-1", content: editFile(text, (doc) => { (doc.basics as Record<string, unknown>).headline = "While open"; }) });
        expect(result).toMatchObject({ ok: true, changed: true });
        expect(useResumeStore.getState().resume.basics.headline).toBe("While open");
        expect((await db.resumes.get("cv-1"))?.basics.headline).toBe("While open"); // and the editor saved it, so nothing can bring the old text back
        useResumeStore.setState({ activeResumeId: null, isDirty: false });
    });

    it("needs a connected folder to export, and then writes into exports/ like a request", async () => {
        expect(await call("request_export", { id: "cv-1", format: "md" })).toMatchObject({ ok: false, code: "needs-folder" });
        const dir = createMemoryDirectory("w");
        const adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
        await db.workspaceDocs.put({ docId: "cv-1", kind: "cv", fileName: "Master CV.cv.json", included: true, state: "in-sync", lastHash: null, lastStamp: null, reason: null, pendingReview: null, updatedAt: 1 });
        const withFolder = { getAdapter: () => adapter };
        const ok = await call("request_export", { id: "cv-1", format: "md" }, withFolder);
        expect(ok).toMatchObject({ ok: true, file: "exports/master-cv.md" });
        expect(await dir.readExternal("exports/master-cv.md")).toContain("Amina");
        expect(await dir.listExternal(".enginecv/results")).toEqual([]); // the one-off result file is cleaned up
        expect(await call("request_export", { id: "cv-1", format: "pdf" }, withFolder)).toMatchObject({ ok: false, code: "format-unavailable" });
        expect(await call("request_export", { id: "l-1", format: "json" }, withFolder)).toMatchObject({ ok: false, code: "format-unavailable" });
        expect(await call("request_export", { id: "zzz", format: "md" }, withFolder)).toMatchObject({ ok: false, code: "unknown-document" });
    });
});
