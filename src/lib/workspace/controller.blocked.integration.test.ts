import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { makeLetter, makeSentLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { createMemoryDirectory } from "../../../test/setup/memory-directory";
import { cutOff, editFile, makeWorkspaceCv, withoutSection } from "../../../test/setup/workspace-fixtures";
import { readAppDocuments } from "./apply-stored";
import type { ChangeSource } from "./change-source";
import { createDirectoryAdapter } from "./directory-adapter";
import { createWorkspaceRuntime, type WorkspaceRuntime } from "./runtime";
import { analyzeFolder, runSetup } from "./setup";
import type { ReasonCode } from "./types";

/**
 * Every refusal must reach the agent: one small note in `.enginecv/results/`, one line in the log, the
 * code and (where known) the place in the file that is at fault, and never any text from the document.
 */

const STAND_IN = { kind: "directory", name: "w" } as unknown as FileSystemDirectoryHandle;
const quietSource = (): ChangeSource => ({ kind: "poll", slow: false, async start() {}, stop() {}, nudge() {}, onVisibilityChange() {} });
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const SECRET = "SECRET-TEXT-4711";
const GUT = ["experience", "education", "projects", "courses", "certificates", "organisations", "awards", "publications", "references", "custom", "skills", "languages"];

async function connected() {
    const dir = createMemoryDirectory("w");
    const adapter = createDirectoryAdapter(dir.root as unknown as FileSystemDirectoryHandle);
    const docs = await readAppDocuments();
    const analysis = await analyzeFolder(adapter, docs, { hideContact: false, now: 1 });
    await runSetup({ adapter, handle: STAND_IN, plan: analysis.plan, appDocs: analysis.appDocs, docs, options: { hideContact: false, now: 1 } });
    const runtime = createWorkspaceRuntime({ adapter, hideContact: () => false, isVisible: () => true, createSource: quietSource, requests: false, machineFiles: false });
    await runtime.start();
    return { dir, runtime };
}

interface Case {
    name: string;
    code: ReasonCode;
    docId: string;
    /** Makes the folder wrong; gets the current text of the document's file. */
    make: (dir: ReturnType<typeof createMemoryDirectory>, text: string) => Promise<void>;
    file: string;
}

const CV_FILE = "cvs/Master CV.cv.json";
const LETTER_FILE = "letters/Acme.letter.json";
const SENT_FILE = "letters/Sent one.letter.json";

const CASES: Case[] = [
    { name: "empty file", code: "empty", docId: "cv-1", file: CV_FILE, make: (dir) => dir.writeExternal(CV_FILE, "") },
    { name: "oversized file", code: "too-large", docId: "cv-1", file: CV_FILE, make: (dir) => dir.writeExternal(CV_FILE, `{"basics":{"name":"${SECRET}"}}${" ".repeat(210 * 1024)}`) },
    { name: "not JSON", code: "invalid-json", docId: "cv-1", file: CV_FILE, make: (dir) => dir.writeExternal(CV_FILE, `{ name: ${SECRET}`) },
    { name: "cut off halfway", code: "invalid-json", docId: "cv-1", file: CV_FILE, make: (dir, text) => dir.writeExternal(CV_FILE, cutOff(text, 0.5)) },
    { name: "no content", code: "no-document", docId: "cv-1", file: CV_FILE, make: (dir) => dir.writeExternal(CV_FILE, "{}") },
    { name: "newer format", code: "newer-version", docId: "cv-1", file: CV_FILE, make: (dir) => dir.writeExternal(CV_FILE, JSON.stringify({ format: "enginecv.authoring/v99", basics: { name: SECRET } })) },
    { name: "a change that drops most entries", code: "shrink-guard", docId: "cv-1", file: CV_FILE, make: (dir, text) => dir.writeExternal(CV_FILE, GUT.reduce((acc, section) => withoutSection(acc, section), text)) },
    { name: "a letter field of the wrong kind", code: "invalid-field", docId: "l-1", file: LETTER_FILE, make: (dir, text) => dir.writeExternal(LETTER_FILE, editFile(text, (doc) => { doc.layout = SECRET; })) },
    { name: "an edit to a sent letter", code: "sent-letter", docId: "l-sent", file: SENT_FILE, make: (dir, text) => dir.writeExternal(SENT_FILE, editFile(text, (doc) => { doc.subject = SECRET; })) },
    { name: "two files for one document", code: "duplicate-id", docId: "cv-1", file: CV_FILE, make: (dir, text) => dir.writeExternal("cvs/Copy of master.cv.json", text) },
    { name: "a deleted file", code: "file-missing", docId: "cv-1", file: CV_FILE, make: (dir) => dir.removeExternal(CV_FILE) },
];

describe("every refusal reaches the agent", () => {
    let current: WorkspaceRuntime | null = null;
    beforeEach(async () => {
        await resetLetterTables();
        await db.workspace.clear();
        await db.workspaceDocs.clear();
        await db.workspaceActivity.clear();
        await db.resumes.put(makeWorkspaceCv({ id: "cv-1", title: "Master CV", name: "Amina Hodzic" }));
        await db.coverLetters.put(makeLetter({ id: "l-1", cvId: "cv-1", title: "Acme", company: "Acme", role: "Designer", subject: "Application for Designer" }));
        await db.coverLetters.put(makeSentLetter({ id: "l-sent", cvId: "cv-1", title: "Sent one", company: "Initech", role: "Lead", senderName: "Amina Hodzic" }));
    });
    afterEach(() => {
        current?.stop();
        current = null;
    });

    it.each(CASES)("$name ($code): a one-line note, a log line, no document text", async ({ code, docId, file, make }) => {
        const { dir, runtime } = await connected();
        current = runtime;
        await make(dir, (await dir.readExternal(file)) ?? "");
        await runtime.checkNow();
        await wait(120);

        const raw = await dir.readExternal(`.enginecv/results/${docId}.refused.json`);
        expect(raw, "refusal note").not.toBeNull();
        expect(raw!.trim().split("\n")).toHaveLength(1); // one line
        const note = JSON.parse(raw!);
        expect(note).toMatchObject({ doc: docId, refused: true, code });

        const lines = ((await dir.readExternal(".enginecv/log.ndjson")) ?? "").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
        expect(lines.some((line) => line.doc === docId && line.code === code && (line.outcome === "refused" || line.outcome === "review" || line.outcome === "info")), "log line").toBe(true);

        // Where the fault is, when it is known.
        if (code === "invalid-field") expect(note.field).toBe("layout");
        if (code === "invalid-json" || code === "cut-off") expect(note.line ?? 0).toBeGreaterThanOrEqual(0);
        if (code === "shrink-guard") expect(note.field).toMatch(/\d+ of \d+ kept/);

        // Nothing the document says, in the note, the log or the activity list.
        const everything = raw + ((await dir.readExternal(".enginecv/log.ndjson")) ?? "") + JSON.stringify(await db.workspaceActivity.toArray());
        for (const secret of [SECRET, "Amina Hodzic", "Application for Designer", "Initech"]) expect(everything, `${secret} must not leak`).not.toContain(secret);
    });

    it("clears the note once the file is accepted again", async () => {
        const { dir, runtime } = await connected();
        current = runtime;
        const good = (await dir.readExternal(CV_FILE))!;
        await dir.writeExternal(CV_FILE, cutOff(good, 0.4));
        await runtime.checkNow();
        await wait(60);
        expect(await dir.readExternal(".enginecv/results/cv-1.refused.json")).not.toBeNull();
        await dir.writeExternal(CV_FILE, editFile(good, (doc) => { (doc.basics as Record<string, unknown>).headline = "Fixed"; }));
        await runtime.checkNow();
        await wait(60);
        expect(await dir.readExternal(".enginecv/results/cv-1.refused.json")).toBeNull();
    });
});
