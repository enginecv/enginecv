/**
 * Every kind of item EngineCV can leave in a browser, in one place. The
 * Your data page, the data export, "delete all my data" and the cookie
 * policy all read this list, and `registry-coverage.unit.test.ts` fails when
 * code stores a key that is not here. Texts are message keys
 * (`storage.purpose.<id>`, `storage.retention.<retention>`), never prose.
 */

export const ENGINECV_DATABASE = "EngineCVDatabase";

export type StorageLocation =
    | "indexeddb-database"
    | "indexeddb-table"
    | "local-storage"
    | "session-storage"
    | "cookie"
    | "cache"
    | "service-worker";

export type LegalBasis = "user-content" | "functional" | "necessary" | "consent";
export type StorageOwner = "enginecv" | "cloudflare" | "google";
export type Retention = "until-deleted" | "one-year" | "session" | "short" | "removed-automatically";
/** yes = page script can remove it; server-clear = only the clear-site-data response; browser-settings = neither. */
export type Removability = "yes" | "server-clear" | "browser-settings";

export interface RegistryEntry {
    id: string;
    location: StorageLocation;
    /** Exact name: key, cookie, table or database. */
    name: string;
    /** Families of names (e.g. `_ga_<id>`). Matched with `^…$` semantics by the caller's RegExp. */
    pattern?: RegExp;
    /** Owning database, for tables. */
    database?: string;
    legalBasis: LegalBasis;
    owner: StorageOwner;
    retention: Retention;
    jsReadable: boolean;
    removable: Removability;
    /** legacy = left by an older version; only read once to migrate, then removed. */
    status: "active" | "legacy";
    /** JSON field in the stored value that holds a change time, if any. */
    timestampField?: string;
}

const active = { status: "active" } as const;
const legacy = {
    status: "legacy",
    legalBasis: "functional",
    owner: "enginecv",
    retention: "removed-automatically",
    jsReadable: true,
    removable: "yes",
} as const;

export const STORAGE_REGISTRY = [
    // Your own content.
    { ...active, id: "idb.database", location: "indexeddb-database", name: ENGINECV_DATABASE, legalBasis: "user-content", owner: "enginecv", retention: "until-deleted", jsReadable: true, removable: "yes" },
    { ...active, id: "idb.resumes", location: "indexeddb-table", name: "resumes", database: ENGINECV_DATABASE, legalBasis: "user-content", owner: "enginecv", retention: "until-deleted", jsReadable: true, removable: "yes", timestampField: "updatedAt" },
    { ...active, id: "idb.resumeHistory", location: "indexeddb-table", name: "resumeHistory", database: ENGINECV_DATABASE, legalBasis: "user-content", owner: "enginecv", retention: "until-deleted", jsReadable: true, removable: "yes", timestampField: "createdAt" },
    { ...active, id: "idb.templates", location: "indexeddb-table", name: "templates", database: ENGINECV_DATABASE, legalBasis: "user-content", owner: "enginecv", retention: "until-deleted", jsReadable: true, removable: "yes", timestampField: "updatedAt" },

    // Settings and small choices.
    { ...active, id: "ls.preferences", location: "local-storage", name: "enginecv-preferences", legalBasis: "functional", owner: "enginecv", retention: "until-deleted", jsReadable: true, removable: "yes", timestampField: "updatedAt" },
    { ...active, id: "ls.consent", location: "local-storage", name: "enginecv-consent", legalBasis: "necessary", owner: "enginecv", retention: "until-deleted", jsReadable: true, removable: "yes", timestampField: "decidedAt" },
    { ...active, id: "ls.readmeCredit", location: "local-storage", name: "enginecv-readme-credit", legalBasis: "functional", owner: "enginecv", retention: "until-deleted", jsReadable: true, removable: "yes" },
    { ...active, id: "ls.localeSuggestionDismissed", location: "local-storage", name: "enginecv-locale-suggestion-dismissed", legalBasis: "functional", owner: "enginecv", retention: "until-deleted", jsReadable: true, removable: "yes" },
    { ...active, id: "cookie.locale", location: "cookie", name: "enginecv-locale", legalBasis: "functional", owner: "enginecv", retention: "one-year", jsReadable: true, removable: "yes" },

    // Third parties: EngineCV cannot read these.
    { ...active, id: "cookie.cloudflare", location: "cookie", name: "__cf_bm", legalBasis: "necessary", owner: "cloudflare", retention: "short", jsReadable: false, removable: "server-clear" },
    { ...active, id: "cookie.google", location: "cookie", name: "Google ad cookies", legalBasis: "consent", owner: "google", retention: "one-year", jsReadable: false, removable: "browser-settings" },

    // Left by older versions, migrated into enginecv-preferences or purged.
    { ...legacy, id: "legacy.theme", location: "local-storage", name: "enginecv-theme" },
    { ...legacy, id: "legacy.locale", location: "local-storage", name: "enginecv-locale" },
    { ...legacy, id: "legacy.dashboardTab", location: "local-storage", name: "enginecv_dashboard_tab" },
    { ...legacy, id: "legacy.dashboardDensity", location: "local-storage", name: "enginecv_dashboard_density" },
    { ...legacy, id: "legacy.autoSave", location: "local-storage", name: "enginecv_autoSave" },
    { ...legacy, id: "legacy.commandPreferences", location: "local-storage", name: "enginecv-command-preferences" },
    { ...legacy, id: "legacy.exportPrefs", location: "local-storage", name: "enginecv-export-prefs" },
    { ...legacy, id: "legacy.showChat", location: "local-storage", name: "enginecv_showChat" },
    { ...legacy, id: "legacy.ref", location: "cookie", name: "enginecv_ref" },
    { ...legacy, id: "legacy.refPending", location: "cookie", name: "enginecv_ref_pending" },
    { ...legacy, id: "legacy.ga", location: "cookie", name: "_ga", pattern: /^_ga(_.+)?$/ },
    { ...legacy, id: "legacy.gid", location: "cookie", name: "_gid" },
] as const satisfies readonly RegistryEntry[];

export type RegistryId = (typeof STORAGE_REGISTRY)[number]["id"];

export interface FoundKey {
    location: StorageLocation;
    name: string;
    database?: string;
}

/** The registry entry an item found in the browser belongs to, or null when EngineCV does not know it. */
export function matchEntry(found: FoundKey): RegistryEntry | null {
    const entries: readonly RegistryEntry[] = STORAGE_REGISTRY;
    return entries.find((entry) => {
        if (entry.location !== found.location) return false;
        if (entry.database !== found.database) return false;
        return entry.name === found.name || (entry.pattern?.test(found.name) ?? false);
    }) ?? null;
}

/** Entries page script cannot see: listed as "may exist" instead of being found. */
export function invisibleEntries(): RegistryEntry[] {
    const entries: readonly RegistryEntry[] = STORAGE_REGISTRY;
    return entries.filter((entry) => !entry.jsReadable);
}

/** Every name the product may store under, active or legacy, for the coverage test. */
export function registeredNames(): Set<string> {
    return new Set(STORAGE_REGISTRY.map((entry) => entry.name));
}
