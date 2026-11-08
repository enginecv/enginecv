"use client";

import { create } from "zustand";
import {
    DEFAULT_CLIENT_PREFERENCES,
    clientPreferencesSchema,
    type ClientPreferences,
} from "./schema";
import {
    CLIENT_PREFERENCES_STORAGE_KEY,
    loadClientPreferences,
    needsPreferencesMigration,
    removeLegacyPreferenceKeys,
    saveClientPreferences,
} from "./storage";

interface ClientPreferencesState {
    preferences: ClientPreferences;
    hydrated: boolean;
    hydrate: () => void;
    updateSection: <K extends keyof ClientPreferences>(
        section: K,
        patch: Partial<ClientPreferences[K]>,
    ) => void;
    replacePreferences: (preferences: ClientPreferences) => void;
    resetPreferences: () => void;
}

// Set while "delete all my data" runs (in any tab), so nothing is written back.
let persistenceSuspended = false;

/** Stops saving preferences until the page reloads. In-memory changes still apply. */
export function suspendPreferencePersistence(): void {
    persistenceSuspended = true;
}

function persist(preferences: ClientPreferences): void {
    if (persistenceSuspended || typeof localStorage === "undefined") return;
    try {
        saveClientPreferences(localStorage, preferences);
    } catch {
        // Preference persistence must never block editing.
    }
}

export const useClientPreferencesStore = create<ClientPreferencesState>((set) => ({
    preferences: DEFAULT_CLIENT_PREFERENCES,
    hydrated: false,
    hydrate: () => {
        if (typeof localStorage === "undefined") return;
        const preferences = loadClientPreferences(localStorage);
        if (needsPreferencesMigration(localStorage)) {
            persist(preferences);
            try {
                removeLegacyPreferenceKeys(localStorage);
            } catch {
                // Leftovers are harmless: the envelope now wins.
            }
        }
        set({ preferences, hydrated: true });
    },
    updateSection: (section, patch) => set((state) => {
        const preferences = clientPreferencesSchema.parse({
            ...state.preferences,
            [section]: {
                ...state.preferences[section],
                ...patch,
            },
        });
        // Callers often echo current values on mount (the editor does on load);
        // writing those would store defaults nobody chose, e.g. in a tab that
        // reloads after "delete all my data".
        if (JSON.stringify(preferences[section]) === JSON.stringify(state.preferences[section])) return state;
        persist(preferences);
        return { preferences };
    }),
    replacePreferences: (next) => {
        const preferences = clientPreferencesSchema.parse(next);
        persist(preferences);
        set({ preferences, hydrated: true });
    },
    resetPreferences: () => {
        const preferences = clientPreferencesSchema.parse(DEFAULT_CLIENT_PREFERENCES);
        persist(preferences);
        set({ preferences, hydrated: true });
    },
}));

if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
        if (event.key !== CLIENT_PREFERENCES_STORAGE_KEY || !event.newValue) return;
        try {
            const preferences = loadClientPreferences(localStorage);
            useClientPreferencesStore.setState({ preferences, hydrated: true });
        } catch {
            // Ignore invalid data written by another tab.
        }
    });
}
