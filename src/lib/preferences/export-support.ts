import { create } from "zustand";
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
