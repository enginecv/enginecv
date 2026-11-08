import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { markPrintTipSeen } from "./onboarding";
import { clientPreferencesSchema, DEFAULT_CLIENT_PREFERENCES } from "./schema";
import { useClientPreferencesStore } from "./store";

function resetStore() {
    localStorage.clear();
    useClientPreferencesStore.setState({ preferences: DEFAULT_CLIENT_PREFERENCES, hydrated: false });
}

describe("onboarding preferences", () => {
    beforeEach(resetStore);
    afterEach(resetStore);

    it("defaults to an unseen print tip, also for preferences stored before the field existed", () => {
        expect(clientPreferencesSchema.parse({}).onboarding).toEqual({ printTipSeen: false });
        expect(clientPreferencesSchema.parse({ support: { successfulExportCount: 3 } }).onboarding.printTipSeen).toBe(false);
    });

    it("falls back to unseen for a corrupt value", () => {
        expect(clientPreferencesSchema.parse({ onboarding: { printTipSeen: "yes" } }).onboarding.printTipSeen).toBe(false);
    });

    it("persists the seen flag", () => {
        markPrintTipSeen();
        expect(useClientPreferencesStore.getState().preferences.onboarding.printTipSeen).toBe(true);

        useClientPreferencesStore.setState({ preferences: DEFAULT_CLIENT_PREFERENCES, hydrated: false });
        useClientPreferencesStore.getState().hydrate();
        expect(useClientPreferencesStore.getState().preferences.onboarding.printTipSeen).toBe(true);
    });
});
