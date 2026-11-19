import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { loadLetterHistory } from "@/lib/letters/history";
import { useResumeStore } from "@/lib/store";
import { makeLetter, makeSentLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { cvFileText, makeWorkspaceCv } from "../../../test/setup/workspace-fixtures";
import { readAppDocuments } from "./apply-stored";
import type { ChangeSource } from "./change-source";
import { createDirectoryAdapter } from "./directory-adapter";
import { createWorkspaceRuntime, type WorkspaceRuntime } from "./runtime";
import { analyzeFolder, runSetup } from "./setup";

const STAND_IN = { kind: "directory", name: "w" } as unknown as FileSystemDirectoryHandle;
const LETTER = "letters/Acme.letter.json";
const quietSource = (): ChangeSource => ({ kind: "poll", slow: false, async start() {}, stop() {}, nudge() {}, onVisibilityChange() {} });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const edit = (text: string, change: (doc: Record<string, unknown>) => void) => {
    const doc = JSON.parse(text) as Record<string, unknown>;
    change(doc);
    return `${JSON.stringify(doc, null, 2)}\n`;
};

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

describe("workspace runtime: letters and new files", () => {
    let current: WorkspaceRuntime | null = null;
    beforeEach(async () => {
        await resetLetterTables();
        await db.workspace.clear();
        await db.workspaceDocs.clear();
        await db.workspaceActivity.clear();
        await db.resumeHistory.clear();
        await db.letterHistory.clear();
        await db.resumes.put(makeWorkspaceCv({ id: "cv-1", title: "Master CV" }));
        await db.coverLetters.put(makeLetter({ id: "l-1", cvId: "cv-1", title: "Acme" }));
        useResumeStore.setState({ activeResumeId: null, isDirty: false });
    });
    afterEach(() => {
        current?.stop();
        current = null;
    });

    it("applies a paragraph edit from the file with a restore point, and leaves the rest alone", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const before = (await db.coverLetters.get("l-1"))!;
        await dir.writeExternal(LETTER, edit((await dir.readExternal(LETTER))!, (doc) => { doc.paragraphs = ["I would love to work at {{company}} as {{role}}."]; }));
        await runtime.checkNow();
        await wait(60);
        const after = (await db.coverLetters.get("l-1"))!;
        expect(after.paragraphs[0].markdown).toBe("I would love to work at {{company}} as {{role}}.");
        expect(after.paragraphs[0].id).toBe(before.paragraphs[0].id); // the paragraph keeps its identity
        expect(after.subject).toBe(before.subject);
        expect(after.cvId).toBe("cv-1");
        const history = await loadLetterHistory("l-1");
        expect(history[0].trigger).toBe("file-sync");
        expect(history[0].letter.paragraphs[0].markdown).toBe(before.paragraphs[0].markdown);
        expect((await db.workspaceDocs.get("l-1"))?.state).toBe("in-sync");
    });

    it("writes a change made in the app to the letter file", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const row = (await db.coverLetters.get("l-1"))!;
        await db.coverLetters.put({ ...row, subject: "Typed in the app", updatedAt: row.updatedAt + 1 });
        await wait(1300);
        expect(JSON.parse((await dir.readExternal(LETTER))!).subject).toBe("Typed in the app");
    });

    it("refuses an edit to a sent letter with the duplicate hint, leaving it and its file as they are", async () => {
        await db.coverLetters.put(makeSentLetter({ id: "l-sent", cvId: "cv-1", title: "Sent one", senderName: "Amina Hodzic" }));
        const { dir, runtime } = await connected();
        current = runtime;
        const sentFile = "letters/Sent one.letter.json";
        const before = JSON.stringify(await db.coverLetters.get("l-sent"));
        const text = edit((await dir.readExternal(sentFile))!, (doc) => { doc.subject = "Changed after sending"; });
        await dir.writeExternal(sentFile, text);
        await runtime.checkNow();
        await wait(60);
        expect(JSON.stringify(await db.coverLetters.get("l-sent"))).toBe(before);
        expect(await dir.readExternal(sentFile)).toBe(text);
        expect(await db.workspaceDocs.get("l-sent")).toMatchObject({ state: "blocked", reason: { code: "sent-letter" } });
    });

    it("keeps a link to a CV the app does not have, as a draft, with the reason shown", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        await dir.writeExternal(LETTER, edit((await dir.readExternal(LETTER))!, (doc) => { doc.cv = { id: "ghost-cv", title: "Gone" }; }));
        await runtime.checkNow();
        await wait(60);
        expect(await db.coverLetters.get("l-1")).toMatchObject({ cvId: "ghost-cv", status: "draft" });
        expect((await db.workspaceDocs.get("l-1"))?.reason?.code).toBe("unknown-cv");
    });

    it("turns a letter into a standalone one when the file says so", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        await dir.writeExternal(LETTER, edit((await dir.readExternal(LETTER))!, (doc) => { delete doc.cv; doc.standalone = true; }));
        await runtime.checkNow();
        await wait(60);
        expect(await db.coverLetters.get("l-1")).toMatchObject({ cvId: null, standalone: true });
    });

    it("keeps {{tokens}} as tokens through a round trip, and never makes a javascript: or data: link live", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const evil = "See [click](javascript:alert(1)) and [img](data:text/html;base64,AAAA) at {{company}}.";
        await dir.writeExternal(LETTER, edit((await dir.readExternal(LETTER))!, (doc) => { doc.paragraphs = [evil]; }));
        await runtime.checkNow();
        await wait(60);
        expect((await db.coverLetters.get("l-1"))?.paragraphs[0].markdown).toBe(evil); // stored as text, tokens untouched
        const { LetterMarkdown } = await import("@/components/letters/LetterMarkdown");
        const { render } = await import("@testing-library/react");
        const { createElement } = await import("react");
        const view = render(createElement(LetterMarkdown, { markdown: evil } as never));
        const hrefs = [...view.container.querySelectorAll("a")].map((anchor) => anchor.getAttribute("href") ?? "");
        expect(hrefs.some((href) => /^(javascript|data):/i.test(href))).toBe(false);
        view.unmount();
        const { markdownToLatex } = await import("@/lib/export-latex");
        const { markdownToPlainText } = await import("@/lib/export-plaintext");
        expect(markdownToLatex(evil)).not.toMatch(/javascript:|data:text/);
        expect(markdownToPlainText(evil)).not.toMatch(/javascript:|data:text/);
    });

    it("turns a new, complete CV file an agent made into a new document, and writes its id back", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const master = (await dir.readExternal("cvs/Master CV.cv.json"))!;
        await dir.writeExternal("cvs/Specialized Resume.cv.json", edit(master, (doc) => { delete doc.id; (doc.basics as Record<string, unknown>).headline = "Specialised"; }));
        await runtime.checkNow();
        await wait(1500);
        const all = await db.resumes.toArray();
        expect(all).toHaveLength(2);
        const fresh = all.find((cv) => cv.id !== "cv-1")!;
        expect(fresh.basics.headline).toBe("Specialised");
        expect(await db.workspaceDocs.get(fresh.id!)).toMatchObject({ fileName: "Specialized Resume.cv.json", included: true, state: "in-sync" });
        expect(JSON.parse((await dir.readExternal("cvs/Specialized Resume.cv.json"))!).id).toBe(fresh.id);
        expect(await db.resumes.count()).toBe(2); // not imported twice on later scans
        await runtime.checkNow();
        await wait(100);
        expect(await db.resumes.count()).toBe(2);
    });

    it("turns a new letter file with no CV id into a standalone draft", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        await dir.writeExternal("letters/Fresh.letter.json", JSON.stringify({ format: "enginecv.letter/v1", standalone: true, company: "Initech", paragraphs: ["Hello {{company}}"] }));
        await runtime.checkNow();
        await wait(1500);
        const letters = await db.coverLetters.toArray();
        const fresh = letters.find((letter) => letter.id !== "l-1")!;
        expect(fresh).toMatchObject({ company: "Initech", standalone: true, cvId: null, status: "draft" });
    });

    it("does not import an unfinished file, and imports it once it is complete", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const full = cvFileText(makeWorkspaceCv({ id: "x", title: "Later" }));
        await dir.writeExternal("cvs/Later.cv.json", full.slice(0, Math.floor(full.length / 2)));
        await runtime.checkNow();
        await wait(60);
        expect(await db.resumes.count()).toBe(1);
        await dir.writeExternal("cvs/Later.cv.json", full);
        await runtime.checkNow();
        await wait(60);
        expect(await db.resumes.count()).toBe(2);
    });

    it("does not bring back a document that was deleted, even though its file is still there", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        await db.resumes.put(makeWorkspaceCv({ id: "cv-2", title: "Second" }));
        await runtime.checkNow();
        await wait(60);
        const { retireDocument } = await import("./lifecycle");
        const adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
        await retireDocument(adapter, "cv-1", "keep-file");
        await db.resumes.delete("cv-1");
        await db.workspaceDocs.delete("cv-1");
        runtime.stop();
        const again = createWorkspaceRuntime({ adapter, hideContact: () => false, isVisible: () => true, createSource: quietSource });
        current = again;
        await again.start();
        await again.checkNow();
        await wait(60);
        expect((await db.resumes.toArray()).map((cv) => cv.id)).not.toContain("cv-1");
        expect(await dir.readExternal("cvs/Master CV.cv.json")).not.toBeNull();
    });
});
