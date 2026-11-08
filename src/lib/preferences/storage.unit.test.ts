import { describe, expect, it } from "vitest";
import {
    CLIENT_PREFERENCES_STORAGE_KEY,
    loadClientPreferences,
    needsPreferencesMigration,
    parseImportedClientPreferences,
    saveClientPreferences,
    serializeClientPreferences,
} from "./storage";
import { DEFAULT_CLIENT_PREFERENCES } from "./schema";

class MemoryStorage {
    private values = new Map<string, string>();

    getItem(key: string) {
        return this.values.get(key) ?? null;
    }

    setItem(key: string, value: string) {
        this.values.set(key, value);
    }
}

describe("client preference storage", () => {
    it("round-trips current version envelopes", () => {
        const storage = new MemoryStorage();
        const preferences = {
            ...DEFAULT_CLIENT_PREFERENCES,
            commandPalette: {
                ...DEFAULT_CLIENT_PREFERENCES.commandPalette,
                width: "wide" as const,
            },
        };

        saveClientPreferences(storage, preferences);

        expect(storage.getItem(CLIENT_PREFERENCES_STORAGE_KEY)).toContain("enginecv.preferences");
        expect(loadClientPreferences(storage).commandPalette.width).toBe("wide");
    });

    it("records when preferences were last saved", () => {
        const storage = new MemoryStorage();
        saveClientPreferences(storage, DEFAULT_CLIENT_PREFERENCES, new Date("2026-10-28T12:00:00.000Z"));

        const stored = JSON.parse(storage.getItem(CLIENT_PREFERENCES_STORAGE_KEY) ?? "{}");
        expect(stored.updatedAt).toBe("2026-10-28T12:00:00.000Z");
    });

    it("writes on load only to migrate values from an older version", () => {
        const fresh = new MemoryStorage();
        expect(needsPreferencesMigration(fresh)).toBe(false);

        const legacy = new MemoryStorage();
        legacy.setItem("enginecv_autoSave", "false");
        expect(needsPreferencesMigration(legacy)).toBe(true);

        saveClientPreferences(legacy, DEFAULT_CLIENT_PREFERENCES);
        expect(needsPreferencesMigration(legacy)).toBe(false);
    });

    it("still loads envelopes saved before the change time existed", () => {
        const storage = new MemoryStorage();
        storage.setItem(CLIENT_PREFERENCES_STORAGE_KEY, JSON.stringify({
            kind: "enginecv.preferences",
            schemaVersion: 1,
            preferences: { ...DEFAULT_CLIENT_PREFERENCES, dashboard: { ...DEFAULT_CLIENT_PREFERENCES.dashboard, density: "compact" } },
        }));

        expect(loadClientPreferences(storage).dashboard.density).toBe("compact");
    });

    it("migrates the removed AI panel preference to a closed History panel", () => {
        const storage = new MemoryStorage();
        storage.setItem(CLIENT_PREFERENCES_STORAGE_KEY, JSON.stringify({
            kind: "enginecv.preferences",
            schemaVersion: 1,
            preferences: {
                editor: {
                    autoSave: true,
                    rightPanelVisible: true,
                    rightPanelTab: "ai",
                },
            },
        }));

        const preferences = loadClientPreferences(storage);

        expect(preferences.editor.rightPanelVisible).toBe(false);
        expect(preferences.editor).not.toHaveProperty("rightPanelTab");
    });

    it("migrates scattered legacy values when no envelope exists", () => {
        const storage = new MemoryStorage();
        storage.setItem("enginecv-theme", "light");
        storage.setItem("enginecv-locale", "de");
        storage.setItem("enginecv_autoSave", "false");
        storage.setItem("enginecv_showChat", "false");
        storage.setItem("enginecv_dashboard_density", "compact");
        storage.setItem("enginecv-command-preferences", JSON.stringify({
            pinnedIds: ["save"],
            recentIds: ["export-json"],
        }));

        const preferences = loadClientPreferences(storage);

        expect(preferences.appearance).toEqual({ theme: "light", locale: "de" });
        expect(preferences.editor.autoSave).toBe(false);
        expect(preferences.editor.rightPanelVisible).toBe(false);
        expect(preferences.dashboard.density).toBe("compact");
        expect(preferences.commandPalette.pinnedCommandIds).toEqual(["save"]);
    });

    it("exports and validates versioned preference files", () => {
        const serialized = serializeClientPreferences(DEFAULT_CLIENT_PREFERENCES);
        expect(parseImportedClientPreferences(serialized)).toEqual(DEFAULT_CLIENT_PREFERENCES);
        expect(() => parseImportedClientPreferences(JSON.stringify({
            kind: "enginecv.preferences",
            schemaVersion: 99,
            preferences: {},
        }))).toThrow();
    });
});
