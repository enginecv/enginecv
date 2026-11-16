import { useClientPreferencesStore } from "./store";

/** The print-path tip collapses once the visitor has seen it or exported a PDF. */
export function markPrintTipSeen(): void {
    const store = useClientPreferencesStore.getState();
    if (!store.hydrated) store.hydrate();

    if (useClientPreferencesStore.getState().preferences.onboarding.printTipSeen) return;
    useClientPreferencesStore.getState().updateSection("onboarding", { printTipSeen: true });
}

function hydrated() {
    const store = useClientPreferencesStore.getState();
    if (!store.hydrated) store.hydrate();
    return useClientPreferencesStore.getState();
}

/** Opening Customize is the checklist step the CV cannot show. */
export function markCustomizeSeen(): void {
    const { preferences, updateSection } = hydrated();
    if (!preferences.onboarding.customizeSeen) updateSection("onboarding", { customizeSeen: true });
}

export function hideChecklist(): void {
    hydrated().updateSection("onboarding", { checklistHidden: true });
}

/** Brings the checklist back with its steps open again, so it has something to show. */
export function showChecklistAgain(): void {
    hydrated().updateSection("onboarding", { checklistHidden: false, customizeSeen: false });
}
