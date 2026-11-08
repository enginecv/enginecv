import { useClientPreferencesStore } from "./store";

/** The print-path tip collapses once the visitor has seen it or exported a PDF. */
export function markPrintTipSeen(): void {
    const store = useClientPreferencesStore.getState();
    if (!store.hydrated) store.hydrate();

    if (useClientPreferencesStore.getState().preferences.onboarding.printTipSeen) return;
    useClientPreferencesStore.getState().updateSection("onboarding", { printTipSeen: true });
}
