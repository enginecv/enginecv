import type { Resume } from "@/lib/schema";
import { buildLastResolved, readCvParts, resolveLetter, type LetterWarning } from "./resolve";
import { letterDocumentSchema, type LetterDocument } from "./schema";

/**
 * Freezing stops a letter following its CV. The frozen copy holds what the letter
 * printed at that moment: sender (with per-letter overrides), design, the token
 * values, and the photo when it was shown.
 */
export function freezeLetter(letter: LetterDocument, cv: Resume, now: number): LetterDocument {
    const parts = readCvParts(letter, cv);
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

/** What the person should hear about before this letter is frozen as sent. */
export function sendWarnings(letter: LetterDocument, cv: Resume | null): LetterWarning[] {
    return resolveLetter(letter, cv).warnings.filter((warning) => warning.code !== "cv-missing");
}
