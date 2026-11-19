import { db } from "@/lib/db";
import type { LetterHistoryEntry, LetterHistoryTrigger } from "@/lib/workspace/types";
import { letterDocumentSchema, type LetterDocument } from "./schema";

/**
 * Restore points for letters, the counterpart of `history.ts` for CVs. A restore point holds the
 * letter's text and settings, never its frozen snapshot (the snapshot is the record of what was sent
 * and is not something a restore may change). Consecutive file-sync entries within the rollover
 * window keep the earliest state, so a burst of agent saves is one step back.
 */

export const MAX_LETTER_HISTORY = 50;
const FILE_SYNC_ROLLOVER_MS = 60 * 1000;
const AUTOSAVE_ROLLOVER_MS = 60 * 1000;

const withoutSnapshot = (letter: LetterDocument): LetterDocument => ({ ...letter, frozen: null });

export async function loadLetterHistory(letterId: string): Promise<LetterHistoryEntry[]> {
    const entries = await db.letterHistory.where("letterId").equals(letterId).toArray();
    return entries.sort((a, b) => b.createdAt - a.createdAt);
}

/** Returns the id of the entry that holds this state (a new one, or the latest if nothing changed). */
export async function recordLetterHistory(letter: LetterDocument, trigger: LetterHistoryTrigger, now: number = Date.now()): Promise<number | null> {
    const snapshot = withoutSnapshot(letter);
    const entries = await loadLetterHistory(letter.id);
    const latest = entries[0];
    if (latest && JSON.stringify(latest.letter) === JSON.stringify(snapshot)) return latest.id ?? null;

    const rollover = trigger === "file-sync" ? FILE_SYNC_ROLLOVER_MS : trigger === "autosave" ? AUTOSAVE_ROLLOVER_MS : 0;
    if (latest && rollover > 0 && latest.trigger === trigger && now - latest.createdAt < rollover) return latest.id ?? null;

    const id = await db.letterHistory.add({ letterId: letter.id, createdAt: now, trigger, letter: snapshot });
    const total = entries.length + 1;
    if (total > MAX_LETTER_HISTORY) {
        const oldest = entries.slice(MAX_LETTER_HISTORY - 1).map((entry) => entry.id!).filter((entryId) => entryId !== undefined);
        await db.letterHistory.bulkDelete(oldest);
    }
    return id;
}

/** The letter as it was in a restore point, kept as a draft or as sent exactly as the stored letter is now. */
export function letterFromHistory(entry: LetterHistoryEntry, current: LetterDocument | null): LetterDocument | null {
    const parsed = letterDocumentSchema.safeParse({ ...entry.letter, frozen: current?.frozen ?? null, status: current?.status ?? entry.letter.status });
    return parsed.success ? parsed.data : null;
}
