import { db } from "@/lib/db";
import { createEmptyResume, resumeSchema, type Resume } from "@/lib/schema";
import { applyDeletionDecisions, planCvDeletion, snapshotLetter, type DeletionDecision } from "./deletion";
import { freezeLetter, unfreezeLetter, unfreezeStandalone } from "./freeze";
import { remapLetters, remapParagraphs } from "./import";
import { buildLastResolved } from "./resolve";
import { createId } from "@/lib/id";
import { createLetter, createStandaloneLetter, letterDocumentSchema, paragraphEntrySchema, todayIso, type LetterDocument, type ParagraphEntry, type SenderKey } from "./schema";
import { buildStarterContent } from "./starters";

/**
 * Letters in IndexedDB. Pure rules live in the sibling modules; this file is
 * the only place that reads or writes the `coverLetters` table. Operations that
 * touch more than one table run in one transaction.
 */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A CV row from the database as a full resume. Rows saved before newer settings existed can
 * lack fields, so they go through the schema (which fills defaults). A row that fails the
 * strict schema (an email that is not a valid address, say) is not unreadable: the editor opens
 * it by merging it onto defaults, and letters read it the same way, so the CV a person can
 * open is a CV they can write a letter for. Only a missing or non-object row gives null.
 */
export function parseCv(row: unknown): Resume | null {
    if (!isRecord(row)) return null;
    const parsed = resumeSchema.safeParse(row);
    if (parsed.success) return parsed.data;

    const empty = createEmptyResume();
    const settings = isRecord(row.settings) ? row.settings : {};
    const nested = (key: keyof Resume["settings"]) => ({ ...(empty.settings[key] as object), ...(isRecord(settings[key]) ? (settings[key] as object) : {}) });
    return {
        ...empty,
        ...(row as Partial<Resume>),
        meta: { ...empty.meta, ...(isRecord(row.meta) ? row.meta : {}) },
        basics: { ...empty.basics, ...(isRecord(row.basics) ? row.basics : {}) },
        experience: Array.isArray(row.experience) ? (row.experience as Resume["experience"]) : empty.experience,
        skillGroups: Array.isArray(row.skillGroups) ? (row.skillGroups as Resume["skillGroups"]) : empty.skillGroups,
        settings: {
            ...empty.settings,
            ...(settings as Partial<Resume["settings"]>),
            typography: nested("typography"),
            colors: nested("colors"),
            header: nested("header"),
            spacing: nested("spacing"),
        } as Resume["settings"],
    } as Resume;
}

export async function loadCv(cvId: string | null): Promise<Resume | null> {
    if (!cvId) return null;
    return parseCv(await db.resumes.get(cvId));
}

export async function getLetter(id: string): Promise<LetterDocument | null> {
    const row = await db.coverLetters.get(id);
    if (!row) return null;
    const parsed = letterDocumentSchema.safeParse(row);
    return parsed.success ? parsed.data : null;
}

/** Every letter, newest first. Rows that no longer parse are skipped, never deleted. */
export async function listLetters(): Promise<LetterDocument[]> {
    const rows = await db.coverLetters.orderBy("updatedAt").reverse().toArray();
    const letters: LetterDocument[] = [];
    for (const row of rows) {
        const parsed = letterDocumentSchema.safeParse(row);
        if (parsed.success) letters.push(parsed.data);
    }
    return letters;
}

export interface CreateLetterRecordOptions {
    language?: string;
    company?: string;
    role?: string;
    now?: number;
}

/** A new draft for `cvId` with the language's starter content, saved and returned. */
export async function createLetterRecord(cvId: string, options: CreateLetterRecordOptions = {}): Promise<LetterDocument> {
    const cv = await loadCv(cvId);
    if (!cv) throw new Error("The CV for this letter was not found.");
    const language = options.language ?? cv.settings.language ?? "en";
    const base = createLetter(cv, { cvId, language, now: options.now, starter: buildStarterContent(language, options.role ?? "") });
    const letter = letterDocumentSchema.parse({
        ...base,
        company: options.company ?? "",
        role: options.role ?? "",
        lastResolved: buildLastResolved(base, cv, base.createdAt),
    });
    await db.coverLetters.put(letter);
    return letter;
}

/** A new draft with no CV, saved and returned. The sender block starts empty: the person types it. */
export async function createStandaloneLetterRecord(options: { language: string; company?: string; role?: string; now?: number }): Promise<LetterDocument> {
    const base = createStandaloneLetter({ language: options.language, now: options.now, starter: buildStarterContent(options.language, options.role ?? "") });
    const letter = letterDocumentSchema.parse({ ...base, company: options.company ?? "", role: options.role ?? "" });
    await db.coverLetters.put(letter);
    return letter;
}

export type SaveLetterResult =
    | { ok: true; letter: LetterDocument }
    | { ok: false; conflict: LetterDocument | null };

/**
 * Saves a letter unless another tab saved it since this one loaded it. In that
 * case nothing is written and the newer copy is returned, so the editor can ask
 * instead of silently overwriting.
 */
export async function saveLetter(letter: LetterDocument, loadedUpdatedAt: number, now: number = Date.now()): Promise<SaveLetterResult> {
    return db.transaction("rw", db.coverLetters, db.resumes, async () => {
        const stored = await db.coverLetters.get(letter.id);
        if (stored && stored.updatedAt > loadedUpdatedAt) {
            const newer = letterDocumentSchema.safeParse(stored);
            return { ok: false as const, conflict: newer.success ? newer.data : null };
        }
        const cv = letter.status === "draft" ? await loadCv(letter.cvId) : null;
        const next = letterDocumentSchema.parse({
            ...letter,
            // Strictly later than what was loaded, so the next conflict check can tell.
            updatedAt: Math.max(now, loadedUpdatedAt + 1),
            lastResolved: cv ? buildLastResolved(letter, cv, now) : letter.lastResolved,
        });
        await db.coverLetters.put(next);
        return { ok: true as const, letter: next };
    });
}

/** Deletes a letter and returns the row, so a short-lived undo can put it back exactly. */
export async function deleteLetter(id: string): Promise<LetterDocument | null> {
    const row = await db.coverLetters.get(id);
    if (!row) return null;
    await db.coverLetters.delete(id);
    return row;
}

/** Puts a deleted row back exactly as it was. */
export async function restoreLetter(row: LetterDocument): Promise<void> {
    await db.coverLetters.put(row);
}

export type LetterOperationErrorCode = "not-found" | "not-draft" | "not-frozen" | "cv-missing";

/** A letter operation that cannot proceed; the code says why, so the UI can explain. */
export class LetterOperationError extends Error {
    constructor(readonly code: LetterOperationErrorCode) {
        super(code);
        this.name = "LetterOperationError";
    }
}

export interface RepointResult {
    letter: LetterDocument;
    /** Sender fields the letter had overridden: they stay overridden after the move. */
    keptOverrides: SenderKey[];
}

/**
 * Moves a draft to another CV. Only the link changes: body, recipient and
 * overrides stay as they are, and everything bound to the CV (sender, design,
 * tokens) now comes from the new one.
 */
export async function repointLetter(id: string, cvId: string, now: number = Date.now()): Promise<RepointResult> {
    return db.transaction("rw", db.coverLetters, db.resumes, async () => {
        const stored = await getLetter(id);
        if (!stored) throw new LetterOperationError("not-found");
        if (stored.status !== "draft") throw new LetterOperationError("not-draft");
        const cv = await loadCv(cvId);
        if (!cv) throw new LetterOperationError("cv-missing");
        const letter = letterDocumentSchema.parse({
            ...stored,
            cvId,
            standalone: false,
            updatedAt: Math.max(now, stored.updatedAt + 1),
            lastResolved: buildLastResolved(stored, cv, now),
        });
        await db.coverLetters.put(letter);
        const keptOverrides = (Object.keys(letter.senderOverrides) as SenderKey[]).filter((key) => letter.senderOverrides[key] !== undefined);
        return { letter, keptOverrides };
    });
}

/**
 * A new live draft with `source`'s content, following `cv`. A `label` is appended to the
 * title ("(copy)"); an empty one leaves the title alone. Overrides are kept, the date is
 * today, and a frozen copy is never carried over.
 */
function buildLetterCopy(source: LetterDocument, cvId: string | null, cv: Resume | null, now: number, label: string): LetterDocument {
    const title = source.title.trim() || [source.company, source.role].map((part) => part.trim()).filter(Boolean).join(" - ");
    const base = {
        ...source,
        id: createId(),
        cvId,
        standalone: cvId === null,
        status: "draft" as const,
        frozen: null,
        date: todayIso(now),
        title: label && title ? `${title} (${label})` : title && !label ? source.title : "",
        paragraphs: source.paragraphs.map((paragraph) => ({ ...paragraph, id: createId() })),
        createdAt: now,
        updatedAt: now,
    };
    return letterDocumentSchema.parse({ ...base, lastResolved: cv ? buildLastResolved(base, cv, now) : null });
}

export interface DuplicateLetterOptions {
    /** The CV the copy follows; defaults to the original's. Required when the original has none. */
    cvId?: string;
    /** Added to the title, as for CV copies, e.g. "copy". */
    copyLabel: string;
    now?: number;
}

/**
 * A new live draft with the same content. It follows `cvId` (or the original's CV),
 * keeps the original's sender overrides, takes today's date, and never carries a
 * frozen copy, whatever the original's status.
 */
export async function duplicateLetter(id: string, options: DuplicateLetterOptions): Promise<LetterDocument> {
    const now = options.now ?? Date.now();
    return db.transaction("rw", db.coverLetters, db.resumes, async () => {
        const source = await getLetter(id);
        if (!source) throw new LetterOperationError("not-found");
        const cvId = options.cvId ?? source.cvId;
        // A standalone letter copied without a CV stays standalone.
        if (!cvId && source.standalone) {
            const standaloneCopy = buildLetterCopy(source, null, null, now, options.copyLabel);
            await db.coverLetters.put(standaloneCopy);
            return standaloneCopy;
        }
        const cv = await loadCv(cvId);
        if (!cvId || !cv) throw new LetterOperationError("cv-missing");

        const copy = buildLetterCopy(source, cvId, cv, now, options.copyLabel);
        await db.coverLetters.put(copy);
        return copy;
    });
}

/**
 * Marks a draft as sent: freezes what it prints now. Needs the CV to read from. Any
 * unsaved text in an open editor must be saved first, or it is not part of the snapshot.
 */
export async function markSent(id: string, now: number = Date.now()): Promise<LetterDocument> {
    return db.transaction("rw", db.coverLetters, db.resumes, async () => {
        const stored = await getLetter(id);
        if (!stored) throw new LetterOperationError("not-found");
        if (stored.status !== "draft") throw new LetterOperationError("not-draft");
        const cv = await loadCv(stored.cvId);
        if (!cv && !stored.standalone) throw new LetterOperationError("cv-missing");
        const sent = freezeLetter(stored, cv, now);
        await db.coverLetters.put(sent);
        return sent;
    });
}

/** Sent or snapshot back to a live draft, following `cvId` (default: its own CV). */
export async function unfreeze(id: string, cvId?: string, now: number = Date.now()): Promise<LetterDocument> {
    return db.transaction("rw", db.coverLetters, db.resumes, async () => {
        const stored = await getLetter(id);
        if (!stored) throw new LetterOperationError("not-found");
        if (stored.status === "draft") throw new LetterOperationError("not-frozen");
        const target = cvId ?? stored.cvId;
        if (!target && stored.standalone) {
            const standaloneDraft = unfreezeStandalone(stored, now);
            await db.coverLetters.put(standaloneDraft);
            return standaloneDraft;
        }
        const cv = await loadCv(target);
        if (!target || !cv) throw new LetterOperationError("cv-missing");
        const draft = unfreezeLetter({ ...stored, standalone: false }, target, cv, now);
        await db.coverLetters.put(draft);
        return draft;
    });
}

/** Every letter linked to a CV, newest first. */
export async function listLettersForCv(cvId: string): Promise<LetterDocument[]> {
    const rows = await db.coverLetters.where("cvId").equals(cvId).toArray();
    const letters: LetterDocument[] = [];
    for (const row of rows) {
        const parsed = letterDocumentSchema.safeParse(row);
        if (parsed.success) letters.push(parsed.data);
    }
    return letters.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Deletes a CV and resolves its letters in one transaction, so no letter is ever left
 * pointing at nothing and none is deleted. Every draft needs a decision; a missing one, a
 * link to a CV that does not exist, or any failure leaves the CV and every letter exactly
 * as they were.
 */
export async function deleteCvWithLetters(cvId: string, decisions: readonly DeletionDecision[], now: number = Date.now()): Promise<void> {
    await db.transaction("rw", db.resumes, db.coverLetters, async () => {
        const plan = planCvDeletion(await listLettersForCv(cvId), cvId);
        for (const decision of decisions) {
            if (decision.action !== "link") continue;
            if (decision.cvId === cvId || !(await loadCv(decision.cvId))) throw new LetterOperationError("cv-missing");
        }
        const updated = applyDeletionDecisions(plan, decisions, now);
        await db.coverLetters.bulkPut(updated);
        await db.resumes.delete(cvId);
    });
}

/**
 * Copies every letter of one CV onto another, as live drafts (used when a CV is
 * duplicated and the person wants its letters too). Overrides are kept, text is the
 * same, titles are unchanged since the copies live under another CV.
 */
export async function copyLettersToCv(fromCvId: string, toCvId: string, now: number = Date.now()): Promise<LetterDocument[]> {
    return db.transaction("rw", db.coverLetters, db.resumes, async () => {
        const cv = await loadCv(toCvId);
        if (!cv) throw new LetterOperationError("cv-missing");
        const copies = (await listLettersForCv(fromCvId)).map((source) => buildLetterCopy(source, toCvId, cv, now, ""));
        await db.coverLetters.bulkPut(copies);
        return copies;
    });
}

/** One draft, frozen from its cache, for a letter whose CV is gone and that the person wants to keep as it was. */
export async function convertToSnapshot(id: string, now: number = Date.now()): Promise<LetterDocument> {
    return db.transaction("rw", db.coverLetters, async () => {
        const stored = await getLetter(id);
        if (!stored) throw new LetterOperationError("not-found");
        if (stored.status !== "draft") throw new LetterOperationError("not-draft");
        const snapshot = snapshotLetter(stored, now);
        await db.coverLetters.put(snapshot);
        return snapshot;
    });
}

/** The person's saved paragraphs, newest first. Independent of any letter. */
export async function listParagraphs(): Promise<ParagraphEntry[]> {
    const rows = await db.letterParagraphs.orderBy("updatedAt").reverse().toArray();
    const entries: ParagraphEntry[] = [];
    for (const row of rows) {
        const parsed = paragraphEntrySchema.safeParse(row);
        if (parsed.success) entries.push(parsed.data);
    }
    return entries;
}

/** Creates a saved paragraph, or updates one when `id` is given. A blank name falls back to the text's first words. */
export async function saveParagraph(input: { id?: string; name: string; markdown: string }, now: number = Date.now()): Promise<ParagraphEntry> {
    const existing = input.id ? await db.letterParagraphs.get(input.id) : undefined;
    const name = input.name.trim() || input.markdown.trim().replace(/\s+/g, " ").slice(0, 40);
    const entry = paragraphEntrySchema.parse({
        ...(existing ?? {}),
        ...(input.id ? { id: input.id } : {}),
        name,
        markdown: input.markdown,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
    });
    await db.letterParagraphs.put(entry);
    return entry;
}

export async function deleteParagraph(id: string): Promise<void> {
    await db.letterParagraphs.delete(id);
}

export interface DataExportImportResult {
    resumesAdded: number;
    lettersAdded: number;
    paragraphsAdded: number;
    /** Drafts that came without their CV and need one linked (or a snapshot). */
    orphanedDrafts: number;
}

/**
 * Restores a "Download my data" file's CVs, letters and saved paragraphs in one transaction, so
 * a failure leaves nothing half imported. Every CV gets a new id and each letter's link follows it.
 */
export async function importDataExport(
    resumes: readonly Resume[],
    extras: { letters: readonly LetterDocument[]; paragraphs: readonly ParagraphEntry[] } | undefined,
    now: number = Date.now(),
): Promise<DataExportImportResult> {
    const idMap = new Map<string, string>();
    const rows = resumes.map((resume) => {
        const id = createId();
        if (resume.id) idMap.set(resume.id, id);
        return { ...resume, id, createdAt: now, updatedAt: now };
    });
    return db.transaction("rw", db.resumes, db.coverLetters, db.letterParagraphs, async () => {
        await db.resumes.bulkAdd(rows);
        const remapped = remapLetters(extras?.letters ?? [], idMap);
        const paragraphs = remapParagraphs(extras?.paragraphs ?? [], await db.letterParagraphs.toArray());
        if (remapped.letters.length > 0) await db.coverLetters.bulkAdd(remapped.letters);
        if (paragraphs.length > 0) await db.letterParagraphs.bulkAdd(paragraphs);
        return { resumesAdded: rows.length, lettersAdded: remapped.letters.length, paragraphsAdded: paragraphs.length, orphanedDrafts: remapped.orphanedDrafts };
    });
}
