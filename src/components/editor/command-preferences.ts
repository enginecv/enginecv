import { useClientPreferencesStore } from "@/lib/preferences/store";

const MAX_RECENT_COMMANDS = 8;

export interface CommandPreferences {
    recentIds: string[];
    pinnedIds: string[];
}

export const EMPTY_COMMAND_PREFERENCES: CommandPreferences = {
    recentIds: [],
    pinnedIds: [],
};

function uniqueStrings(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((item): item is string => typeof item === "string"))];
}

export function parseCommandPreferences(raw: string | null): CommandPreferences {
    if (!raw) return EMPTY_COMMAND_PREFERENCES;
    try {
        const parsed = JSON.parse(raw) as Partial<CommandPreferences>;
        return {
            recentIds: uniqueStrings(parsed.recentIds).slice(0, MAX_RECENT_COMMANDS),
            pinnedIds: uniqueStrings(parsed.pinnedIds),
        };
    } catch {
        return EMPTY_COMMAND_PREFERENCES;
    }
}

export function loadCommandPreferences(): CommandPreferences {
    const store = useClientPreferencesStore.getState();
    if (!store.hydrated) store.hydrate();
    const preferences = useClientPreferencesStore.getState().preferences.commandPalette;
    return {
        recentIds: preferences.recentCommandIds,
        pinnedIds: preferences.pinnedCommandIds,
    };
}

export function saveCommandPreferences(preferences: CommandPreferences): void {
    useClientPreferencesStore.getState().updateSection("commandPalette", {
        recentCommandIds: preferences.recentIds,
        pinnedCommandIds: preferences.pinnedIds,
    });
}

export function recordRecentCommand(
    preferences: CommandPreferences,
    commandId: string,
): CommandPreferences {
    return {
        ...preferences,
        recentIds: [
            commandId,
            ...preferences.recentIds.filter((id) => id !== commandId),
        ].slice(0, MAX_RECENT_COMMANDS),
    };
}

export function togglePinnedCommand(
    preferences: CommandPreferences,
    commandId: string,
): CommandPreferences {
    const pinned = preferences.pinnedIds.includes(commandId);
    return {
        ...preferences,
        pinnedIds: pinned
            ? preferences.pinnedIds.filter((id) => id !== commandId)
            : [...preferences.pinnedIds, commandId],
    };
}
