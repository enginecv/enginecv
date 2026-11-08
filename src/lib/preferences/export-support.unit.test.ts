import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getKofiUrl } from "../support";
import { clientPreferencesSchema, DEFAULT_CLIENT_PREFERENCES } from "./schema";
import { CLIENT_PREFERENCES_STORAGE_KEY } from "./storage";
import {
    dismissExportSupportPrompt,
    isExportSupportMilestone,
    recordSuccessfulExport,
} from "./export-support";
import { useClientPreferencesStore } from "./store";

describe("export support prompt preferences", () => {
    beforeEach(() => {
        localStorage.clear();
        useClientPreferencesStore.setState({
            preferences: DEFAULT_CLIENT_PREFERENCES,
            hydrated: false,
        });
    });

    afterEach(() => {
        localStorage.clear();
        useClientPreferencesStore.setState({
            preferences: DEFAULT_CLIENT_PREFERENCES,
            hydrated: false,
        });
    });

    it("detects support prompt milestones", () => {
        expect([1, 5, 15].map(isExportSupportMilestone)).toEqual([true, true, true]);
        expect([0, 2, 3, 4, 6, 14, 16].map(isExportSupportMilestone)).toEqual([
            false,
            false,
            false,
            false,
            false,
            false,
            false,
        ]);
    });

    it("returns true exactly at export support milestones", () => {
        const prompts = Array.from({ length: 15 }, () => recordSuccessfulExport());

        expect(prompts).toEqual([
            true,
            false,
            false,
            false,
            true,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            true,
        ]);
    });

    it("suppresses support prompts after dismissal and persists dismissal", () => {
        Array.from({ length: 4 }, () => recordSuccessfulExport());
        dismissExportSupportPrompt();

        expect(recordSuccessfulExport()).toBe(false);
        expect(localStorage.getItem(CLIENT_PREFERENCES_STORAGE_KEY)).toContain("enginecv.preferences");

        useClientPreferencesStore.setState({
            preferences: DEFAULT_CLIENT_PREFERENCES,
            hydrated: false,
        });
        useClientPreferencesStore.getState().hydrate();

        expect(useClientPreferencesStore.getState().preferences.support).toEqual({
            successfulExportCount: 5,
            exportPromptDismissed: true,
        });
    });

    it("builds Ko-fi placement URLs", () => {
        expect(getKofiUrl("export")).toBe("/go/kofi/export");
    });

    it("defaults support preferences when parsing empty input", () => {
        expect(clientPreferencesSchema.parse({}).support).toEqual({
            successfulExportCount: 0,
            exportPromptDismissed: false,
        });
    });
});
