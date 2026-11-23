import { create } from "zustand";
import { optedOut, reportExportComment, reportExportRating, type ExportRatingValue } from "@/lib/analytics/export-event";
import type { ResumeExportFormat } from "@/lib/export-formats";
import { useClientPreferencesStore } from "./store";

export const EXPORT_SUPPORT_PROMPT_MILESTONES = [1, 5, 15] as const;

export function isExportSupportMilestone(count: number): boolean {
    return EXPORT_SUPPORT_PROMPT_MILESTONES.some((milestone) => milestone === count);
}

export function recordSuccessfulExport(): boolean {
    const store = useClientPreferencesStore.getState();
    if (!store.hydrated) store.hydrate();

    const { preferences, updateSection } = useClientPreferencesStore.getState();
    const next = preferences.support.successfulExportCount + 1;
    updateSection("support", { successfulExportCount: next });

    return !preferences.support.exportPromptDismissed && isExportSupportMilestone(next);
}

export function dismissExportSupportPrompt(): void {
    const store = useClientPreferencesStore.getState();
    if (!store.hydrated) store.hydrate();

    useClientPreferencesStore.getState().updateSection("support", {
        exportPromptDismissed: true,
    });
}

interface ExportSupportPromptState {
    visible: boolean;
    show: () => void;
    hide: () => void;
}

/** Session-only visibility of the post-export card; the persisted state lives in `support` preferences. */
export const useExportSupportPromptStore = create<ExportSupportPromptState>((set) => ({
    visible: false,
    show: () => set({ visible: true }),
    hide: () => set({ visible: false }),
}));

/** Export counts that ask for a thumbs up/down. Never one of the support milestones, so the two cards never meet. */
export const EXPORT_RATING_PROMPT_MILESTONES = [2, 8] as const;

/**
 * Call right after `recordSuccessfulExport`. True on a rating milestone, unless the
 * person already answered or said "don't ask again", or their browser asks for no
 * measurement (a rating could not be sent, so it is not asked for).
 */
export function shouldAskExportRating(): boolean {
    const { preferences } = useClientPreferencesStore.getState();
    const { successfulExportCount, exportRatingDone } = preferences.support;
    return !exportRatingDone && EXPORT_RATING_PROMPT_MILESTONES.some((milestone) => milestone === successfulExportCount) && !optedOut();
}

/** Sends the anonymous rating and stops asking: one answer is enough. */
export function submitExportRating(rating: ExportRatingValue, format: ResumeExportFormat): void {
    reportExportRating(rating, format);
    declineExportRating();
}

/** Sends the optional words that follow a thumbs answer. */
export function submitExportComment(rating: ExportRatingValue, format: ResumeExportFormat, comment: string): void {
    reportExportComment(rating, format, comment);
}

export function declineExportRating(): void {
    const store = useClientPreferencesStore.getState();
    if (!store.hydrated) store.hydrate();
    useClientPreferencesStore.getState().updateSection("support", { exportRatingDone: true });
}

interface ExportRatingPromptState {
    format: ResumeExportFormat | null;
    show: (format: ResumeExportFormat) => void;
    hide: () => void;
}

/** Session-only: which export the open rating card is about (null = hidden). */
export const useExportRatingPromptStore = create<ExportRatingPromptState>((set) => ({
    format: null,
    show: (format) => set({ format }),
    hide: () => set({ format: null }),
}));
