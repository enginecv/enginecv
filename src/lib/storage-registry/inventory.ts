import Dexie from "dexie";
import type { ResumeHistoryEntry } from "@/lib/db";
import type { Resume } from "@/lib/schema";
import type { TemplateDocument } from "@/lib/templates/template-schema";
import {
    ENGINECV_DATABASE,
    invisibleEntries,
    matchEntry,
    type RegistryEntry,
    type StorageLocation,
} from "./registry";

/**
 * What is stored in this browser right now. Everything is enumerated
 * generically (every database, key, cookie, cache) and then matched against
 * the registry, so items EngineCV does not know still show up.
 */

export interface FoundItem {
    location: StorageLocation;
    name: string;
    database?: string;
    /** Approximate stored size in bytes (UTF-8 of key + value, or of the rows). */
    sizeBytes?: number;
    /** Rows, for database tables. */
    count?: number;
    /** ISO time of the most recent change, when the stored value records one. */
    updatedAt?: string;
    entry: RegistryEntry | null;
}

export interface EngineCvContent {
    resumes: Resume[];
    resumeHistory: ResumeHistoryEntry[];
    templates: TemplateDocument[];
}

export interface Inventory {
    items: FoundItem[];
    counts: { resumes: number; versions: number; templates: number; other: number };
    totalBytes: number;
    /** Third-party items that may exist but page script cannot see. */
    invisible: RegistryEntry[];
    /** Locations the browser refused to read. */
    unreadable: StorageLocation[];
    /** The database rows, kept for the data export so they are read once. */
    content: EngineCvContent | null;
    /** Raw key/value pairs, kept for the data export. */
    values: { localStorage: Record<string, string>; sessionStorage: Record<string, string>; cookies: Record<string, string> };
}

export interface BrowserAdapters {
    indexedDB: Pick<IDBFactory, "databases"> | null;
    localStorage: Storage | null;
    sessionStorage: Storage | null;
    cookies: () => string;
    caches: Pick<CacheStorage, "keys"> | null;
    serviceWorker: Pick<ServiceWorkerContainer, "getRegistrations"> | null;
    databaseExists: (name: string) => Promise<boolean>;
    readEngineCvContent: () => Promise<EngineCvContent>;
}

function safely<T>(read: () => T): T | null {
    try {
        return read();
    } catch {
        return null;
    }
}

export function browserAdapters(): BrowserAdapters {
    const hasWindow = typeof window !== "undefined";
    return {
        indexedDB: hasWindow ? safely(() => window.indexedDB) : null,
        localStorage: hasWindow ? safely(() => window.localStorage) : null,
        sessionStorage: hasWindow ? safely(() => window.sessionStorage) : null,
        cookies: () => (typeof document === "undefined" ? "" : document.cookie),
        caches: hasWindow && "caches" in window ? window.caches : null,
        serviceWorker: typeof navigator !== "undefined" && "serviceWorker" in navigator ? navigator.serviceWorker : null,
        databaseExists: (name) => Dexie.exists(name),
        readEngineCvContent: async () => {
            // Imported here so the inventory never opens (and so creates) the database unless it exists.
            const { db } = await import("@/lib/db");
            const [resumes, resumeHistory, templates] = await Promise.all([
                db.resumes.toArray(),
                db.resumeHistory.toArray(),
                db.templates.toArray(),
            ]);
            return { resumes, resumeHistory, templates };
        },
    };
}

const encoder = new TextEncoder();

function bytes(text: string): number {
    return encoder.encode(text).length;
}

function toIso(value: unknown): string | undefined {
    if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
    if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
    return undefined;
}

function newest(rows: readonly object[], field: string | undefined): string | undefined {
    if (!field) return undefined;
    let best: string | undefined;
    for (const row of rows) {
        const iso = toIso((row as Record<string, unknown>)[field]);
        if (iso && (!best || iso > best)) best = iso;
    }
    return best;
}

function readStorage(storage: Storage): Record<string, string> {
    const values: Record<string, string> = {};
    for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key !== null) values[key] = storage.getItem(key) ?? "";
    }
    return values;
}

export function parseCookies(cookieString: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    for (const part of cookieString.split(";")) {
        const separator = part.indexOf("=");
        const name = (separator < 0 ? part : part.slice(0, separator)).trim();
        if (!name) continue;
        cookies[name] = separator < 0 ? "" : part.slice(separator + 1).trim();
    }
    return cookies;
}

function storageItems(location: "local-storage" | "session-storage", values: Record<string, string>): FoundItem[] {
    return Object.entries(values).map(([name, value]) => {
        const entry = matchEntry({ location, name });
        let updatedAt: string | undefined;
        if (entry?.timestampField) {
            const parsed = safely(() => JSON.parse(value) as Record<string, unknown>);
            updatedAt = toIso(parsed?.[entry.timestampField]);
        }
        return { location, name, sizeBytes: bytes(name) + bytes(value), updatedAt, entry };
    });
}

const TABLES = ["resumes", "resumeHistory", "templates"] as const;

export async function collectInventory(overrides: Partial<BrowserAdapters> = {}): Promise<Inventory> {
    const adapters = { ...browserAdapters(), ...overrides };
    const items: FoundItem[] = [];
    const unreadable = new Set<StorageLocation>();

    // Databases: every one this origin has, then EngineCV's own tables in detail.
    let databaseNames: string[] = [];
    const listed = adapters.indexedDB?.databases
        ? await adapters.indexedDB.databases().catch(() => null)
        : null;
    if (listed) {
        databaseNames = listed.map((info) => info.name).filter((name): name is string => Boolean(name));
    } else if (await adapters.databaseExists(ENGINECV_DATABASE).catch(() => false)) {
        databaseNames = [ENGINECV_DATABASE];
    }

    let content: EngineCvContent | null = null;
    for (const name of databaseNames) {
        items.push({ location: "indexeddb-database", name, entry: matchEntry({ location: "indexeddb-database", name }) });
        if (name !== ENGINECV_DATABASE) continue;
        content = await adapters.readEngineCvContent().catch(() => {
            unreadable.add("indexeddb-table");
            return null;
        });
        if (!content) continue;
        for (const table of TABLES) {
            const rows = content[table] as readonly object[];
            const entry = matchEntry({ location: "indexeddb-table", name: table, database: ENGINECV_DATABASE });
            items.push({
                location: "indexeddb-table",
                name: table,
                database: ENGINECV_DATABASE,
                count: rows.length,
                sizeBytes: rows.reduce((sum, row) => sum + bytes(JSON.stringify(row)), 0),
                updatedAt: newest(rows, entry?.timestampField),
                entry,
            });
        }
    }

    // Browser and tab storage.
    const localValues = adapters.localStorage ? safely(() => readStorage(adapters.localStorage!)) : null;
    if (localValues) items.push(...storageItems("local-storage", localValues));
    else unreadable.add("local-storage");

    const sessionValues = adapters.sessionStorage ? safely(() => readStorage(adapters.sessionStorage!)) : null;
    if (sessionValues) items.push(...storageItems("session-storage", sessionValues));
    else unreadable.add("session-storage");

    // Cookies page script can see. Their creation time is never exposed.
    const cookies = parseCookies(safely(adapters.cookies) ?? "");
    for (const [name, value] of Object.entries(cookies)) {
        items.push({ location: "cookie", name, sizeBytes: bytes(name) + bytes(value), entry: matchEntry({ location: "cookie", name }) });
    }

    // Caches and background workers: EngineCV uses neither, but leftovers count.
    const cacheNames = adapters.caches ? await adapters.caches.keys().catch(() => null) : [];
    if (cacheNames) {
        for (const name of cacheNames) items.push({ location: "cache", name, entry: matchEntry({ location: "cache", name }) });
    } else unreadable.add("cache");

    const registrations = adapters.serviceWorker ? await adapters.serviceWorker.getRegistrations().catch(() => null) : [];
    if (registrations) {
        for (const registration of registrations) {
            const name = registration.scope;
            items.push({ location: "service-worker", name, entry: matchEntry({ location: "service-worker", name }) });
        }
    } else unreadable.add("service-worker");

    const resumes = content?.resumes.length ?? 0;
    const versions = content?.resumeHistory.length ?? 0;
    const templates = content?.templates.length ?? 0;
    const other = items.filter((item) => item.location !== "indexeddb-database" && item.location !== "indexeddb-table").length;

    return {
        items,
        counts: { resumes, versions, templates, other },
        totalBytes: items.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0),
        invisible: invisibleEntries(),
        unreadable: [...unreadable],
        content,
        values: { localStorage: localValues ?? {}, sessionStorage: sessionValues ?? {}, cookies },
    };
}

/** True when nothing EngineCV's pages could remove is left. */
export function isInventoryEmpty(inventory: Inventory): boolean {
    return inventory.items.length === 0;
}
