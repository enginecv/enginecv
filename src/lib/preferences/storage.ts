import {
    CLIENT_PREFERENCES_KIND,
    CLIENT_PREFERENCES_VERSION,
    DEFAULT_CLIENT_PREFERENCES,
    clientPreferencesEnvelopeSchema,
    clientPreferencesSchema,
    type ClientPreferences,
    type ClientPreferencesEnvelope,
} from "./schema";

export const CLIENT_PREFERENCES_STORAGE_KEY = "enginecv-preferences";

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

function readJson(storage: StorageReader, key: string): unknown {
    const raw = storage.getItem(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function legacyString(
    storage: StorageReader,
    key: string,
    allowed: readonly string[],
    fallback: string,
): string {
    const value = storage.getItem(key);
    return value && allowed.includes(value) ? value : fallback;
}

function legacyBoolean(storage: StorageReader, key: string, fallback: boolean): boolean {
    const value = storage.getItem(key);
    return value === "true" ? true : value === "false" ? false : fallback;
}

export function migrateLegacyClientPreferences(storage: StorageReader): ClientPreferences {
    const commandPreferences = readJson(storage, "enginecv-command-preferences") as {
        pinnedIds?: unknown;
        recentIds?: unknown;
    } | null;
    const exportPreferences = readJson(storage, "enginecv-export-prefs") as {
        format?: unknown;
        pdfIncludeSidecar?: unknown;
    } | null;

    return clientPreferencesSchema.parse({
        appearance: {
            theme: legacyString(
                storage,
                "enginecv-theme",
                ["light", "dark", "system"],
                DEFAULT_CLIENT_PREFERENCES.appearance.theme,
            ),
            locale: legacyString(
                storage,
                "enginecv-locale",
                ["en", "bs", "de", "fr", "es"],
                DEFAULT_CLIENT_PREFERENCES.appearance.locale,
            ),
        },
        dashboard: {
            activeTab: legacyString(
                storage,
                "enginecv_dashboard_tab",
                ["resumes", "letters", "templates"],
                DEFAULT_CLIENT_PREFERENCES.dashboard.activeTab,
            ),
            density: legacyString(
                storage,
                "enginecv_dashboard_density",
                ["large", "normal", "compact"],
                DEFAULT_CLIENT_PREFERENCES.dashboard.density,
            ),
        },
        editor: {
            autoSave: legacyBoolean(storage, "enginecv_autoSave", true),
            rightPanelVisible: DEFAULT_CLIENT_PREFERENCES.editor.rightPanelVisible,
        },
        commandPalette: {
            width: DEFAULT_CLIENT_PREFERENCES.commandPalette.width,
            height: DEFAULT_CLIENT_PREFERENCES.commandPalette.height,
            pinnedCommandIds: Array.isArray(commandPreferences?.pinnedIds)
                ? commandPreferences.pinnedIds
                : [],
            recentCommandIds: Array.isArray(commandPreferences?.recentIds)
                ? commandPreferences.recentIds
                : [],
        },
        export: {
            format: exportPreferences?.format === "encrypted-json"
                ? "json"
                : exportPreferences?.format,
            pdfIncludeSidecar: exportPreferences?.pdfIncludeSidecar,
        },
    });
}

export function loadClientPreferences(storage: StorageReader): ClientPreferences {
    const stored = readJson(storage, CLIENT_PREFERENCES_STORAGE_KEY);
    const parsed = clientPreferencesEnvelopeSchema.safeParse(stored);
    return parsed.success
        ? parsed.data.preferences
        : migrateLegacyClientPreferences(storage);
}

const LEGACY_PREFERENCE_KEYS = [
    "enginecv-theme",
    "enginecv-locale",
    "enginecv_dashboard_tab",
    "enginecv_dashboard_density",
    "enginecv_autoSave",
    "enginecv-command-preferences",
    "enginecv-export-prefs",
    // Written by the AI panel removed in cfc64b8; nothing reads it.
    "enginecv_showChat",
];

/**
 * True when loading has to write: no valid envelope yet, but values from an
 * older version to carry over. A valid envelope is already stored, and a
 * first visit needs nothing stored until a setting changes (so its change
 * time stays meaningful, and a fresh tab after "delete all my data" stores
 * nothing).
 */
export function needsPreferencesMigration(storage: StorageReader): boolean {
    if (clientPreferencesEnvelopeSchema.safeParse(readJson(storage, CLIENT_PREFERENCES_STORAGE_KEY)).success) return false;
    return LEGACY_PREFERENCE_KEYS.some((key) => storage.getItem(key) !== null);
}

/** Once carried over into the envelope, the old keys go (as the storage registry promises). */
export function removeLegacyPreferenceKeys(storage: Pick<Storage, "removeItem">): void {
    for (const key of LEGACY_PREFERENCE_KEYS) storage.removeItem(key);
}

export function createClientPreferencesEnvelope(
    preferences: ClientPreferences,
    exportedAt?: string,
    updatedAt?: string,
): ClientPreferencesEnvelope {
    return clientPreferencesEnvelopeSchema.parse({
        kind: CLIENT_PREFERENCES_KIND,
        schemaVersion: CLIENT_PREFERENCES_VERSION,
        exportedAt,
        updatedAt,
        preferences,
    });
}

export function saveClientPreferences(
    storage: StorageWriter,
    preferences: ClientPreferences,
    now: Date = new Date(),
): void {
    const envelope = createClientPreferencesEnvelope(preferences, undefined, now.toISOString());
    storage.setItem(CLIENT_PREFERENCES_STORAGE_KEY, JSON.stringify(envelope));
}

export function parseImportedClientPreferences(raw: string): ClientPreferences {
    const json = JSON.parse(raw) as unknown;
    return clientPreferencesEnvelopeSchema.parse(json).preferences;
}

export function serializeClientPreferences(preferences: ClientPreferences): string {
    return JSON.stringify(
        createClientPreferencesEnvelope(preferences, new Date().toISOString()),
        null,
        2,
    );
}
