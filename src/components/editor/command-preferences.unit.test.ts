import { describe, expect, it } from "vitest";
import {
    EMPTY_COMMAND_PREFERENCES,
    parseCommandPreferences,
    recordRecentCommand,
    togglePinnedCommand,
} from "./command-preferences";

describe("command preferences", () => {
    it("keeps newest unique recent commands with a bounded history", () => {
        let preferences = EMPTY_COMMAND_PREFERENCES;
        for (let index = 0; index < 10; index += 1) {
            preferences = recordRecentCommand(preferences, `command-${index}`);
        }
        preferences = recordRecentCommand(preferences, "command-5");

        expect(preferences.recentIds).toHaveLength(8);
        expect(preferences.recentIds[0]).toBe("command-5");
        expect(new Set(preferences.recentIds).size).toBe(8);
    });

    it("toggles pinned command ids", () => {
        const pinned = togglePinnedCommand(EMPTY_COMMAND_PREFERENCES, "save");
        const unpinned = togglePinnedCommand(pinned, "save");

        expect(pinned.pinnedIds).toEqual(["save"]);
        expect(unpinned.pinnedIds).toEqual([]);
    });

    it("sanitizes malformed persisted values", () => {
        expect(parseCommandPreferences("{")).toEqual(EMPTY_COMMAND_PREFERENCES);
        expect(parseCommandPreferences(JSON.stringify({
            recentIds: ["save", "save", 7],
            pinnedIds: ["export", null],
        }))).toEqual({
            recentIds: ["save"],
            pinnedIds: ["export"],
        });
    });
});
