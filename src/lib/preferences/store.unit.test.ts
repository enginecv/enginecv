import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CLIENT_PREFERENCES } from "./schema";
import { CLIENT_PREFERENCES_STORAGE_KEY } from "./storage";
import { suspendPreferencePersistence, useClientPreferencesStore } from "./store";

function resetStore() {
    localStorage.clear();
    useClientPreferencesStore.setState({ preferences: DEFAULT_CLIENT_PREFERENCES, hydrated: false });
}

describe("client preferences store", () => {
    beforeEach(resetStore);
    afterEach(resetStore);

    it("stores nothing on a first visit or when a section update changes nothing", () => {
        const store = useClientPreferencesStore.getState();
        store.hydrate();
        store.updateSection("editor", { ...DEFAULT_CLIENT_PREFERENCES.editor });
        expect(localStorage.getItem(CLIENT_PREFERENCES_STORAGE_KEY)).toBeNull();
    });

    it("stores a section update that changes a value", () => {
        useClientPreferencesStore.getState().updateSection("editor", {
            autoSave: !DEFAULT_CLIENT_PREFERENCES.editor.autoSave,
        });
        expect(localStorage.getItem(CLIENT_PREFERENCES_STORAGE_KEY)).not.toBeNull();
    });

    // Last: suspension lasts until reload, so it would leak into later tests.
    it("stores nothing once suspended for a data wipe, but still applies changes", () => {
        suspendPreferencePersistence();
        useClientPreferencesStore.getState().updateSection("editor", {
            autoSave: !DEFAULT_CLIENT_PREFERENCES.editor.autoSave,
        });
        expect(useClientPreferencesStore.getState().preferences.editor.autoSave).toBe(!DEFAULT_CLIENT_PREFERENCES.editor.autoSave);
        expect(localStorage.getItem(CLIENT_PREFERENCES_STORAGE_KEY)).toBeNull();
    });
});
