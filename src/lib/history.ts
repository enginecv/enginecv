import { db, type ResumeHistoryEntry, type ResumeHistoryTrigger } from "./db";
import { resumeSchema, type Resume } from "./schema";

const MAX_HISTORY_ENTRIES = 50;
const AUTOSAVE_ROLLOVER_MS = 60 * 1000;

export async function loadResumeHistory(resumeId: string) {
    const entries = await db.resumeHistory.where("resumeId").equals(resumeId).toArray();
    return entries.sort((left, right) => right.createdAt - left.createdAt);
}

export function getRelativeHistorySelection(
    entryIds: number[],
    selectedEntryId: number | null,
    direction: "back" | "forward",
) {
    if (entryIds.length === 0) {
        return null;
    }

    if (direction === "back") {
        if (selectedEntryId === null) {
            return entryIds[0] ?? null;
        }

        const currentIndex = entryIds.indexOf(selectedEntryId);
        if (currentIndex === -1) {
            return entryIds[0] ?? null;
        }

        return entryIds[Math.min(currentIndex + 1, entryIds.length - 1)] ?? selectedEntryId;
    }

    if (selectedEntryId === null) {
        return null;
    }

    const currentIndex = entryIds.indexOf(selectedEntryId);
    if (currentIndex <= 0) {
        return null;
    }

    return entryIds[currentIndex - 1] ?? null;
}

export function parseHistoryResume(entry: ResumeHistoryEntry) {
    try {
        const parsedJson = JSON.parse(entry.resumeJson);
        const parsed = resumeSchema.safeParse(parsedJson);
        if (!parsed.success) {
            return null;
        }

        return {
            ...parsed.data,
            createdAt: typeof parsedJson?.createdAt === "number"
                ? parsedJson.createdAt
                : (typeof parsedJson?.updatedAt === "number" ? parsedJson.updatedAt : parsed.data.createdAt),
        };
    } catch {
        return null;
    }
}

export async function recordResumeHistory(resume: Resume, trigger: ResumeHistoryTrigger) {
    if (!resume.id) {
        return null;
    }

    const snapshot = JSON.stringify(resume);
    const existingEntries = await loadResumeHistory(resume.id);
    const latestEntry = existingEntries[0];
    const now = Date.now();

    if (latestEntry?.resumeJson === snapshot) {
        return latestEntry.id ?? null;
    }

    if (
        trigger === "autosave" &&
        latestEntry?.id &&
        latestEntry.trigger === "autosave" &&
        now - latestEntry.createdAt < AUTOSAVE_ROLLOVER_MS
    ) {
        await db.resumeHistory.update(latestEntry.id, {
            createdAt: now,
            resumeJson: snapshot,
        });
        return latestEntry.id;
    }

    const historyId = await db.resumeHistory.add({
        resumeId: resume.id,
        createdAt: now,
        trigger,
        resumeJson: snapshot,
    });

    const nextEntries = await loadResumeHistory(resume.id);
    if (nextEntries.length > MAX_HISTORY_ENTRIES) {
        const staleEntries = nextEntries.slice(MAX_HISTORY_ENTRIES);
        await db.resumeHistory.bulkDelete(
            staleEntries
                .map((entry) => entry.id)
                .filter((id): id is number => typeof id === "number")
        );
    }

    return historyId;
}
