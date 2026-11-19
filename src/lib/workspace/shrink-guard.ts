import type { Resume } from "@/lib/schema";
import { ENTRY_SECTIONS } from "@/lib/linked-file/apply-content";
import type { PendingReview } from "./types";

/**
 * A complete, valid file can still be a bad change: an agent that rewrites the file and drops a
 * section. When it keeps fewer than half of a document's entries and removes at least three, it is not
 * applied; the person reviews it first. Smaller removals apply normally.
 */

export const GUARD_MIN_REMOVED = 3;
const MAX_TITLES = 10;

export interface ShrinkVerdict {
    triggered: boolean;
    previousCount: number;
    keptCount: number;
    removedCount: number;
}

export function checkShrink(previousCount: number, keptCount: number): ShrinkVerdict {
    const removedCount = Math.max(0, previousCount - keptCount);
    return { triggered: keptCount < previousCount / 2 && removedCount >= GUARD_MIN_REMOVED, previousCount, keptCount, removedCount };
}

const TITLE_KEYS = ["position", "title", "name", "degree", "institution", "company", "issuer", "role", "language", "text"];

function titleOf(entry: Record<string, unknown>): string {
    for (const key of TITLE_KEYS) {
        const value = entry[key];
        if (typeof value === "string" && value.trim()) return value.trim().slice(0, 60);
    }
    return "…";
}

/**
 * Titles of the CV entries the incoming CV would remove (matched by id), for the review dialog.
 * They are shown in the app only; logs and result files never carry them.
 */
export function removedEntryTitles(before: Resume, after: Resume, max: number = MAX_TITLES): { titles: string[]; total: number } {
    const kept = new Set<string>();
    for (const key of ENTRY_SECTIONS) for (const entry of after[key] as unknown as Array<{ id: string }>) kept.add(`${key}:${entry.id}`);
    for (const group of after.skillGroups) for (const skill of group.skills) kept.add(`skills:${skill.id}`);
    for (const section of after.customSections) kept.add(`custom:${section.id}`);

    const removed: string[] = [];
    for (const key of ENTRY_SECTIONS) {
        for (const entry of before[key] as unknown as Array<Record<string, unknown> & { id: string }>) if (!kept.has(`${key}:${entry.id}`)) removed.push(titleOf(entry));
    }
    for (const group of before.skillGroups) for (const skill of group.skills) if (!kept.has(`skills:${skill.id}`)) removed.push(skill.name || "…");
    for (const section of before.customSections) if (!kept.has(`custom:${section.id}`)) removed.push(section.title || "…");
    return { titles: removed.slice(0, max), total: removed.length };
}

export function pendingReviewFor(verdict: ShrinkVerdict, titles: string[], now: number): PendingReview {
    return { removed: titles, keptCount: verdict.keptCount, previousCount: verdict.previousCount, at: now };
}
