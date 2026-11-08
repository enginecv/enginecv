import { closeDatabaseForDeletion } from "@/lib/db";
import { cookieDomainsFor, saveAdConsent } from "@/lib/consent";
import { announceWipe } from "./cross-tab";
import { browserAdapters, collectInventory, parseCookies, type BrowserAdapters, type FoundItem } from "./inventory";
import { ENGINECV_DATABASE, type RegistryEntry, type StorageLocation } from "./registry";

/**
 * "Delete all my data". Order matters: stop saving here and in other tabs
 * first, so nothing is written back; then remove every database, storage,
 * cache, worker and cookie page script can reach; then ask the browser
 * (through the server's Clear-Site-Data response) for the rest; then check.
 */

export type WipeStep = "stopping" | "database" | "storage" | "cookies" | "server" | "verifying";
export type ServerClear = "ok" | "offline" | "failed";

export interface RemainingItem {
    location: StorageLocation;
    name: string;
    reason: "blocked" | "not-removable" | "error";
}

export interface DeletionResult {
    status: "complete" | "partial";
    remaining: RemainingItem[];
    serverClear: ServerClear;
    /** Third-party items that may still exist (EngineCV cannot see them). */
    mayRemain: RegistryEntry[];
}

export type DeleteOutcome = "deleted" | "blocked" | "error";

export interface WipeAdapters extends BrowserAdapters {
    /** Stops autosave and every database write in this tab. */
    suspend: () => Promise<void> | void;
    deleteDatabase: (name: string, blockedTimeoutMs: number) => Promise<DeleteOutcome>;
    deleteCache: (name: string) => Promise<boolean>;
    setCookie: (cookie: string) => void;
    hostname: string;
    online: () => boolean;
    clearSiteData: () => Promise<boolean>;
    withdrawConsent: () => void;
    announce: typeof announceWipe;
}

export const CLEAR_SITE_DATA_PATH = "/api/clear-site-data";

function nativeDeleteDatabase(name: string, blockedTimeoutMs: number): Promise<DeleteOutcome> {
    if (name === ENGINECV_DATABASE) closeDatabaseForDeletion();
    return new Promise((resolve) => {
        let settled = false;
        const finish = (outcome: DeleteOutcome) => {
            if (settled) return;
            settled = true;
            resolve(outcome);
        };
        const request = window.indexedDB.deleteDatabase(name);
        request.onsuccess = () => finish("deleted");
        request.onerror = () => finish("error");
        // Another tab still has it open. It was told to close; give it a moment, never hang.
        request.onblocked = () => setTimeout(() => finish("blocked"), blockedTimeoutMs);
    });
}

export function wipeAdapters(): WipeAdapters {
    return {
        ...browserAdapters(),
        suspend: async () => {
            // Imported lazily: the store is large and pages without the editor do not load it.
            const [{ useResumeStore }, { suspendPreferencePersistence }] = await Promise.all([
                import("@/lib/store"),
                import("@/lib/preferences/store"),
            ]);
            suspendPreferencePersistence();
            useResumeStore.getState().suspendPersistence();
        },
        deleteDatabase: nativeDeleteDatabase,
        deleteCache: (name) => window.caches.delete(name),
        setCookie: (cookie) => {
            document.cookie = cookie;
        },
        hostname: window.location.hostname,
        online: () => navigator.onLine,
        clearSiteData: async () => {
            const response = await fetch(CLEAR_SITE_DATA_PATH, { method: "POST", credentials: "same-origin", cache: "no-store" });
            return response.ok;
        },
        withdrawConsent: () => {
            // Tells loaded ad code to stop now; the stored value goes with the rest of the storage.
            saveAdConsent("denied");
        },
        announce: announceWipe,
    };
}

function expireCookies(adapters: WipeAdapters) {
    const names = Object.keys(parseCookies(adapters.cookies()));
    for (const name of names) {
        for (const domain of cookieDomainsFor(adapters.hostname)) {
            adapters.setCookie(`${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}; SameSite=Lax`);
        }
    }
}

function clearStorages(adapters: WipeAdapters) {
    try {
        adapters.localStorage?.clear();
    } catch {
        // Reported by the verify step.
    }
    try {
        adapters.sessionStorage?.clear();
    } catch {
        // Reported by the verify step.
    }
}

function remainingFrom(items: FoundItem[], blocked: Set<string>): RemainingItem[] {
    return items.map((item) => {
        const databaseName = item.location === "indexeddb-database" ? item.name : item.database;
        const reason: RemainingItem["reason"] = databaseName && blocked.has(databaseName)
            ? "blocked"
            : item.entry && item.entry.removable !== "yes" ? "not-removable" : "error";
        return { location: item.location, name: item.name, reason };
    });
}

export async function wipeAllData(options: {
    adapters?: Partial<WipeAdapters>;
    onStep?: (step: WipeStep) => void;
    blockedTimeoutMs?: number;
} = {}): Promise<DeletionResult> {
    const adapters: WipeAdapters = { ...wipeAdapters(), ...options.adapters };
    const step = options.onStep ?? (() => {});
    const blockedTimeoutMs = options.blockedTimeoutMs ?? 3000;

    step("stopping");
    await adapters.suspend();
    adapters.announce("wipe-start");
    adapters.withdrawConsent();

    step("database");
    const before = await collectInventory(adapters);
    const blocked = new Set<string>();
    const databases = before.items.filter((item) => item.location === "indexeddb-database").map((item) => item.name);
    for (const name of databases) {
        const outcome = await adapters.deleteDatabase(name, blockedTimeoutMs).catch((): DeleteOutcome => "error");
        if (outcome === "blocked") blocked.add(name);
    }
    for (const item of before.items) {
        if (item.location === "cache") await adapters.deleteCache(item.name).catch(() => false);
    }
    const registrations = adapters.serviceWorker ? await adapters.serviceWorker.getRegistrations().catch(() => []) : [];
    for (const registration of registrations) await registration.unregister().catch(() => false);

    step("storage");
    clearStorages(adapters);

    step("cookies");
    expireCookies(adapters);

    step("server");
    let serverClear: ServerClear = "offline";
    if (adapters.online()) {
        serverClear = (await adapters.clearSiteData().catch(() => false)) ? "ok" : "failed";
    }

    step("verifying");
    // Anything that slipped in during the steps above (a late write) goes too.
    clearStorages(adapters);
    expireCookies(adapters);
    const after = await collectInventory({
        ...adapters,
        // The deleted database must not be reopened (and so recreated) just to look.
        readEngineCvContent: async () => ({ resumes: [], resumeHistory: [], templates: [] }),
    });
    const remaining = remainingFrom(after.items, blocked);

    adapters.announce("wipe-done");

    return {
        status: remaining.length === 0 ? "complete" : "partial",
        remaining,
        serverClear,
        mayRemain: after.invisible.filter((entry) => entry.removable === "browser-settings" || serverClear !== "ok"),
    };
}
