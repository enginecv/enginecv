import { createId } from "@/lib/id";
import { letterDocumentSchema, paragraphEntrySchema, type LetterDocument, type ParagraphEntry } from "./schema";

/**
 * Letters and saved paragraphs inside a "Download my data" file, restored on import.
 *
 * Every imported CV gets a new id, so a letter's link is remapped to the new CV. Nothing is
 * overwritten: each letter and paragraph is added with a new id. A draft whose CV is not in
 * the file is kept, pointing at a CV that does not exist: it then shows as "needs a CV" and
 * offers the same link-or-snapshot choice as a deleted CV, instead of being dropped.
 */

/** Prefix for the link of a draft whose CV was not in the file; never matches a real CV id. */
export const MISSING_CV_PREFIX = "missing:";

export interface DataExportLetters {
    letters: LetterDocument[];
    paragraphs: ParagraphEntry[];
}

export interface RemappedLetters {
    letters: LetterDocument[];
    /** Drafts imported without their CV. */
    orphanedDrafts: number;
}

/** Parses what a data export holds, skipping rows that no longer fit the schema. */
export function parseLettersFromExport(rawLetters: unknown, rawParagraphs: unknown): DataExportLetters {
    const parse = <T,>(raw: unknown, parser: (row: unknown) => T | null): T[] => (Array.isArray(raw) ? raw.flatMap((row) => parser(row) ?? []) : []);
    return {
        letters: parse(rawLetters, (row) => {
            const result = letterDocumentSchema.safeParse(row);
            return result.success ? result.data : null;
        }),
        paragraphs: parse(rawParagraphs, (row) => {
            const result = paragraphEntrySchema.safeParse(row);
            return result.success ? result.data : null;
        }),
    };
}

/** New ids for every letter, links remapped through `idMap` (old CV id to new CV id). */
export function remapLetters(letters: readonly LetterDocument[], idMap: ReadonlyMap<string, string>): RemappedLetters {
    let orphanedDrafts = 0;
    const remapped = letters.map((letter) => {
        const target = letter.cvId ? idMap.get(letter.cvId) : undefined;
        let cvId: string | null;
        if (letter.standalone) cvId = null;
        else if (target) cvId = target;
        else if (letter.status === "draft") {
            cvId = `${MISSING_CV_PREFIX}${letter.cvId ?? ""}`;
            orphanedDrafts += 1;
        } else cvId = null;
        return letterDocumentSchema.parse({ ...letter, id: createId(), cvId });
    });
    return { letters: remapped, orphanedDrafts };
}

/** Saved paragraphs with new ids, leaving out any that the library already holds (same name and text). */
export function remapParagraphs(imported: readonly ParagraphEntry[], existing: readonly ParagraphEntry[]): ParagraphEntry[] {
    const known = new Set(existing.map((entry) => `${entry.name}\u0000${entry.markdown}`));
    const result: ParagraphEntry[] = [];
    for (const entry of imported) {
        const key = `${entry.name}\u0000${entry.markdown}`;
        if (known.has(key)) continue;
        known.add(key);
        result.push(paragraphEntrySchema.parse({ ...entry, id: createId() }));
    }
    return result;
}
