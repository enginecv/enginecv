import type { Resume } from "@/lib/schema";
import { buildLastResolved, readCvParts, readStandaloneParts, resolveLetter, type LetterWarning } from "./resolve";
import { letterDocumentSchema, type LetterDocument } from "./schema";

/**
 * Freezing stops a letter following its CV. The frozen copy holds what the letter
 * printed at that moment: sender (with per-letter overrides), design, the token
 * values, and the photo when it was shown.
 */
export function freezeLetter(letter: LetterDocument, cv: Resume | null, now: number): LetterDocument {
    if (!cv && !letter.standalone) throw new Error("A letter that follows a CV needs that CV to be frozen.");
    const parts = letter.standalone || !cv ? readStandaloneParts(letter) : readCvParts(letter, cv);
    return letterDocumentSchema.parse({
        ...letter,
        status: "sent",
        frozen: { at: now, sender: parts.sender, design: parts.design, tokens: parts.tokens, photo: parts.photo, cvTitle: parts.cvTitle },
        updatedAt: Math.max(now, letter.updatedAt + 1),
    });
}

/**
 * Makes a sent or snapshot letter a live draft again, following `cv`. The frozen
 * copy is discarded; the text, recipient and overrides are untouched.
 */
export function unfreezeLetter(letter: LetterDocument, cvId: string, cv: Resume, now: number): LetterDocument {
    const draft = { ...letter, status: "draft" as const, cvId, frozen: null };
    return letterDocumentSchema.parse({
        ...draft,
        lastResolved: buildLastResolved(draft, cv, now),
        updatedAt: Math.max(now, letter.updatedAt + 1),
    });
}

/**
 * A standalone sent letter back to a live standalone draft. Nothing to follow: the frozen copy
 * is discarded and the sender and design the person typed (kept in the overrides) apply again.
 */
export function unfreezeStandalone(letter: LetterDocument, now: number): LetterDocument {
    return letterDocumentSchema.parse({
        ...letter,
        status: "draft",
        cvId: null,
        frozen: null,
        updatedAt: Math.max(now, letter.updatedAt + 1),
    });
}

/** What the person should hear about before this letter is frozen as sent. */
export function sendWarnings(letter: LetterDocument, cv: Resume | null): LetterWarning[] {
    return resolveLetter(letter, cv).warnings.filter((warning) => warning.code !== "cv-missing");
}
