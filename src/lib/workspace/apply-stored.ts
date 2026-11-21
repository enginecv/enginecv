import { db } from "@/lib/db";
import { recordResumeHistory } from "@/lib/history";
import { createId } from "@/lib/id";
import { applyLetterContent, letterFromContent } from "@/lib/letters/apply-content";
import { parseLetterText } from "@/lib/letters/file-format";
import { recordLetterHistory } from "@/lib/letters/history";
import { letterDocumentSchema, type LetterDocument } from "@/lib/letters/schema";
import { parseCv } from "@/lib/letters/store";
import type { Resume } from "@/lib/schema";
import type { Notice } from "@/lib/agent/authoring/notices";
import { createCvCodec } from "./codecs/cv";
import type { DocReason } from "./types";

/**
 * Applying file text to documents that are stored but not open in an editor, or creating documents
 * from files: the same codecs and rules as the live engine, with a restore point taken first.
 * Used by the first sync ("use the file") and by documents that are closed when a file changes.
 */

const cvCodec = createCvCodec();

export type StoredApplyResult =
    | { ok: true; restoreId: number | null; notices: Notice[]; changed: boolean }
    | { ok: false; reason: DocReason };

export async function readAppDocuments(): Promise<{ cvs: Resume[]; letters: LetterDocument[] }> {
    const rows = await db.resumes.toArray();
    const cvs = rows.map((row) => parseCv(row)).filter((cv): cv is Resume => cv !== null);
    const letterRows = await db.coverLetters.toArray();
    const letters: LetterDocument[] = [];
    for (const row of letterRows) {
        const parsed = letterDocumentSchema.safeParse(row);
        if (parsed.success) letters.push(parsed.data);
    }
    return { cvs, letters };
}

/** Applies file text to a stored CV: restore point first, design, photo and signature kept. */
export async function applyFileToStoredCv(docId: string, text: string, options: { hideContact: boolean; now?: number }): Promise<StoredApplyResult> {
    const now = options.now ?? Date.now();
    const row = await db.resumes.get(docId);
    const before = row ? parseCv(row) : null;
    if (!before) return { ok: false, reason: { code: "file-missing" } };

    const parsed = cvCodec.parse(text, { now, hideContact: options.hideContact });
    if (!parsed.ok) return { ok: false, reason: parsed.reason };
    const next = cvCodec.apply(before, parsed.doc, { hideContact: options.hideContact });
    if (cvCodec.isSameContent(before, next)) return { ok: true, restoreId: null, notices: parsed.notices, changed: false };

    const restoreId = await recordResumeHistory(before, "file-sync");
    await db.resumes.put({ ...next, updatedAt: Math.max(now, before.updatedAt + 1) });
    return { ok: true, restoreId, notices: parsed.notices, changed: true };
}

/** Applies file text to a stored letter; a sent letter is refused with the reason that explains how to copy it. */
export async function applyFileToStoredLetter(docId: string, text: string, options: { now?: number } = {}): Promise<StoredApplyResult> {
    const now = options.now ?? Date.now();
    const row = await db.coverLetters.get(docId);
    const parsedRow = row ? letterDocumentSchema.safeParse(row) : null;
    if (!parsedRow?.success) return { ok: false, reason: { code: "file-missing" } };
    const before = parsedRow.data;
    if (before.status !== "draft") return { ok: false, reason: { code: "sent-letter" } };

    const parsed = parseLetterText(text);
    if (!parsed.ok) return { ok: false, reason: parsed.reason };
    let next: LetterDocument;
    try {
        next = applyLetterContent(before, parsed.content, now);
    } catch {
        return { ok: false, reason: { code: "invalid-field" } };
    }
    if (JSON.stringify({ ...next, updatedAt: 0 }) === JSON.stringify({ ...before, updatedAt: 0 })) return { ok: true, restoreId: null, notices: parsed.notices, changed: false };

    const restoreId = await recordLetterHistory(before, "file-sync", now);
    await db.coverLetters.put(next);
    return { ok: true, restoreId, notices: parsed.notices, changed: true };
}

export type ImportResult = { ok: true; id: string; notices: Notice[] } | { ok: false; reason: DocReason };

/** Creates a CV from file text. The file's id is kept when no CV has it, else a new id is used. */
export async function importCvFromText(text: string, options: { hideContact: boolean; now?: number }): Promise<ImportResult> {
    const now = options.now ?? Date.now();
    const parsed = cvCodec.parse(text, { now, hideContact: options.hideContact });
    if (!parsed.ok) return { ok: false, reason: parsed.reason };
    const taken = parsed.id ? await db.resumes.get(parsed.id) : null;
    const id = parsed.id && !taken ? parsed.id : createId();
    await db.resumes.put({ ...parsed.doc, id, createdAt: now, updatedAt: now });
    return { ok: true, id, notices: parsed.notices };
}

/** Creates a draft letter from file text; it follows the CV the file names, or stands alone. */
export async function importLetterFromText(text: string, options: { now?: number } = {}): Promise<ImportResult> {
    const now = options.now ?? Date.now();
    const parsed = parseLetterText(text);
    if (!parsed.ok) return { ok: false, reason: parsed.reason };
    const taken = parsed.id ? await db.coverLetters.get(parsed.id) : null;
    const id = parsed.id && !taken ? parsed.id : createId();
    let letter: LetterDocument;
    try {
        letter = letterFromContent(parsed.content, { id, now });
    } catch {
        return { ok: false, reason: { code: "invalid-field" } };
    }
    // A letter that names a CV the app does not have is kept as a draft that needs a CV (spec FR-026);
    // the controller marks it with reason "unknown-cv".
    await db.coverLetters.put(letter);
    return { ok: true, id, notices: parsed.notices };
}
