import type { Locale } from "@/lib/i18n";
import type { FoundItem, Inventory } from "./inventory";
import type { StorageTranslate } from "./messages";
import { SERVER_STATEMENT_KEYS } from "./server-statement";

/**
 * "Download my data": one JSON file with everything EngineCV keeps in this
 * browser. People read the summary and the annotated item list; programs
 * read the same file (and the dashboard imports the CVs back out of it).
 */

export const DATA_EXPORT_FORMAT = "enginecv/data-export";
export const DATA_EXPORT_VERSION = 1;
export const UNKNOWN = "unknown";

export interface DataExportItem {
    location: string;
    name: string;
    database?: string;
    registryId: string | null;
    purpose: string;
    owner: string;
    legalBasis: string;
    retention: string;
    sizeBytes: number | typeof UNKNOWN;
    count?: number;
    updatedAt: string;
}

export interface DataExportFile {
    format: typeof DATA_EXPORT_FORMAT;
    version: typeof DATA_EXPORT_VERSION;
    generatedAt: string;
    appVersion: string;
    origin: string;
    locale: Locale;
    summary: string[];
    items: DataExportItem[];
    data: {
        indexedDB: Record<string, Record<string, unknown[]>>;
        localStorage: Record<string, unknown>;
        sessionStorage: Record<string, unknown>;
        cookies: Record<string, string>;
    };
    notVisible: Array<{ name: string; owner: string; purpose: string; howToRemove: string }>;
    serverSide: string[];
}

function parseValue(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        return raw;
    }
}

function parseValues(values: Record<string, string>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, parseValue(value)]));
}

function annotate(item: FoundItem, ts: StorageTranslate): DataExportItem {
    const entry = item.entry;
    const purposeKey = !entry ? "storage.purpose.unknown" : entry.status === "legacy" ? "storage.purpose.legacy" : `storage.purpose.${entry.id}`;
    return {
        location: item.location,
        name: item.name,
        ...(item.database ? { database: item.database } : {}),
        registryId: entry?.id ?? null,
        purpose: ts(purposeKey),
        owner: entry ? ts(`storage.owner.${entry.owner}`) : UNKNOWN,
        legalBasis: entry?.legalBasis ?? UNKNOWN,
        retention: entry ? ts(`storage.retention.${entry.retention}`) : UNKNOWN,
        sizeBytes: item.sizeBytes ?? UNKNOWN,
        ...(item.count !== undefined ? { count: item.count } : {}),
        updatedAt: item.updatedAt ?? UNKNOWN,
    };
}

export function buildDataExport(
    inventory: Inventory,
    context: { ts: StorageTranslate; locale: Locale; appVersion: string; origin: string; now?: Date },
): DataExportFile {
    const { ts, locale } = context;
    const now = context.now ?? new Date();
    const { resumes, versions, templates, other } = inventory.counts;
    const counts = [
        ts("yourData.summary.resumes", { count: resumes }),
        ts("yourData.summary.versions", { count: versions }),
        ts("yourData.summary.templates", { count: templates }),
        ts("yourData.summary.other", { count: other }),
    ].join(", ");

    const content = inventory.content;
    const indexedDB: DataExportFile["data"]["indexedDB"] = {};
    for (const item of inventory.items) {
        if (item.location === "indexeddb-database") indexedDB[item.name] = {};
    }
    if (content && indexedDB.EngineCVDatabase) {
        indexedDB.EngineCVDatabase = {
            resumes: content.resumes,
            // Versions are stored as JSON text; written out as objects so the file is readable.
            resumeHistory: content.resumeHistory.map(({ resumeJson, ...rest }) => ({ ...rest, resume: parseValue(resumeJson) })),
            templates: content.templates,
        };
    }

    return {
        format: DATA_EXPORT_FORMAT,
        version: DATA_EXPORT_VERSION,
        generatedAt: now.toISOString(),
        appVersion: context.appVersion,
        origin: context.origin,
        locale,
        summary: [
            ts("yourData.file.summary.intro", { date: new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(now) }),
            ts("yourData.file.summary.counts", { counts }),
            ts("yourData.file.summary.items"),
            ts("yourData.file.summary.data"),
            ts("yourData.file.summary.import"),
            ts("yourData.file.summary.notVisible"),
        ],
        items: inventory.items.map((item) => annotate(item, ts)),
        data: {
            indexedDB,
            localStorage: parseValues(inventory.values.localStorage),
            sessionStorage: parseValues(inventory.values.sessionStorage),
            cookies: inventory.values.cookies,
        },
        notVisible: inventory.invisible.map((entry) => ({
            name: entry.name,
            owner: ts(`storage.owner.${entry.owner}`),
            purpose: ts(`storage.purpose.${entry.id}`),
            howToRemove: ts(`storage.how.${entry.removable}`),
        })),
        serverSide: SERVER_STATEMENT_KEYS.map((key) => ts(key)),
    };
}

export function dataExportFileName(now: Date = new Date()): string {
    return `enginecv-my-data-${now.toISOString().slice(0, 10)}.json`;
}

export function isDataExport(json: unknown): json is DataExportFile {
    return typeof json === "object" && json !== null && (json as { format?: unknown }).format === DATA_EXPORT_FORMAT;
}

/** The CVs inside a data export, for the dashboard import. */
export function resumesFromDataExport(file: DataExportFile): unknown[] {
    const resumes = file.data?.indexedDB?.EngineCVDatabase?.resumes;
    return Array.isArray(resumes) ? resumes : [];
}
