import { describe, expect, it, vi } from "vitest";
import { MemoryStorage, seededAdapters } from "./__fixtures__/adapters";
import { isConfirmWord } from "./confirm";
import { ENGINECV_DATABASE } from "./registry";
import { wipeAllData, type DeleteOutcome, type WipeAdapters, type WipeStep } from "./wipe";

/** A browser with every kind of item, whose deletes really remove things. */
function fakeBrowser(options: { deleteOutcome?: DeleteOutcome; online?: boolean; serverOk?: boolean } = {}) {
    const seeded = seededAdapters();
    const databases = new Set([ENGINECV_DATABASE, "SomeOtherDb"]);
    const caches = new Set(["old-cache"]);
    let cookieJar: Record<string, string> = { "enginecv-locale": "de", _ga_X1: "1" };
    const calls: string[] = [];
    seeded.session.setItem("tab-thing", "1");

    const adapters: Partial<WipeAdapters> = {
        ...seeded,
        indexedDB: { databases: async () => [...databases].map((name) => ({ name, version: 1 })) },
        databaseExists: async (name) => databases.has(name),
        caches: { keys: async () => [...caches] },
        cookies: () => Object.entries(cookieJar).map(([name, value]) => `${name}=${value}`).join("; "),
        setCookie: (cookie) => {
            const name = cookie.split("=")[0];
            if (/Max-Age=0/.test(cookie)) {
                cookieJar = Object.fromEntries(Object.entries(cookieJar).filter(([key]) => key !== name));
            }
        },
        hostname: "enginecv.app",
        suspend: () => {
            calls.push("suspend");
        },
        announce: (type) => {
            calls.push(type);
        },
        withdrawConsent: () => {
            calls.push("withdraw");
        },
        deleteDatabase: async (name) => {
            calls.push(`delete:${name}`);
            const outcome = name === ENGINECV_DATABASE ? options.deleteOutcome ?? "deleted" : "deleted";
            if (outcome === "deleted") databases.delete(name);
            return outcome;
        },
        deleteCache: async (name) => caches.delete(name),
        online: () => options.online ?? true,
        clearSiteData: async () => {
            calls.push("server");
            return options.serverOk ?? true;
        },
    };
    return { adapters, calls, local: seeded.local, session: seeded.session, databases };
}

describe("wipeAllData", () => {
    it("removes every database, key, cookie and cache, then confirms nothing is left", async () => {
        const browser = fakeBrowser();
        const steps: WipeStep[] = [];
        const result = await wipeAllData({ adapters: browser.adapters, onStep: (step) => steps.push(step) });

        expect(result).toMatchObject({ status: "complete", remaining: [], serverClear: "ok" });
        expect(browser.databases.size).toBe(0);
        expect(browser.local.length).toBe(0);
        expect(browser.session.length).toBe(0);
        expect(steps).toEqual(["stopping", "database", "storage", "cookies", "server", "verifying"]);
    });

    it("stops saving and tells other tabs before deleting anything", async () => {
        const browser = fakeBrowser();
        await wipeAllData({ adapters: browser.adapters });
        expect(browser.calls.slice(0, 3)).toEqual(["suspend", "wipe-start", "withdraw"]);
        expect(browser.calls.at(-1)).toBe("wipe-done");
        expect(browser.calls).toContain(`delete:${ENGINECV_DATABASE}`);
        expect(browser.calls).toContain("delete:SomeOtherDb");
    });

    it("reports a database another tab keeps open, instead of hanging", async () => {
        const browser = fakeBrowser({ deleteOutcome: "blocked" });
        const result = await wipeAllData({ adapters: browser.adapters, blockedTimeoutMs: 10 });

        expect(result.status).toBe("partial");
        expect(result.remaining).toContainEqual({ location: "indexeddb-database", name: ENGINECV_DATABASE, reason: "blocked" });
        // Everything else is still gone.
        expect(browser.local.length).toBe(0);
    });

    it("still deletes everything local when offline, and says the server step was skipped", async () => {
        const browser = fakeBrowser({ online: false });
        const result = await wipeAllData({ adapters: browser.adapters });
        expect(result).toMatchObject({ status: "complete", serverClear: "offline" });
        expect(browser.calls).not.toContain("server");
        expect(result.mayRemain.map((entry) => entry.name)).toContain("__cf_bm");
    });

    it("reports a failed server clear without failing the local wipe", async () => {
        const browser = fakeBrowser({ serverOk: false });
        const result = await wipeAllData({ adapters: browser.adapters });
        expect(result).toMatchObject({ status: "complete", serverClear: "failed" });
    });

    it("always names Google cookies as something only the browser can remove", async () => {
        const result = await wipeAllData({ adapters: fakeBrowser().adapters });
        expect(result.mayRemain.map((entry) => entry.id)).toEqual(["cookie.google"]);
    });

    it("removes a value written while the wipe was running", async () => {
        const browser = fakeBrowser();
        const original = browser.adapters.clearSiteData!;
        browser.adapters.clearSiteData = async () => {
            browser.local.setItem("enginecv-preferences", "{}");
            return original();
        };
        const result = await wipeAllData({ adapters: browser.adapters });
        expect(result.status).toBe("complete");
        expect(browser.local.length).toBe(0);
    });

    it("does not reopen the deleted database to verify", async () => {
        const browser = fakeBrowser();
        const read = vi.fn(async () => ({ resumes: [], resumeHistory: [], templates: [] }));
        let reads = 0;
        browser.adapters.readEngineCvContent = async () => {
            reads += 1;
            return read();
        };
        await wipeAllData({ adapters: browser.adapters });
        expect(reads).toBe(1); // the inventory before deleting, never after
    });

    it("handles storage it cannot clear as a partial result", async () => {
        const browser = fakeBrowser();
        const stuck = new MemoryStorage();
        stuck.setItem("enginecv-consent", "{}");
        stuck.clear = () => {
            throw new Error("denied");
        };
        browser.adapters.localStorage = stuck;
        const result = await wipeAllData({ adapters: browser.adapters });
        expect(result.status).toBe("partial");
        expect(result.remaining).toContainEqual({ location: "local-storage", name: "enginecv-consent", reason: "error" });
    });
});

describe("isConfirmWord", () => {
    it("accepts the word in the user's language or DELETE, ignoring case and spaces", () => {
        expect(isConfirmWord(" löschen ", "LÖSCHEN")).toBe(true);
        expect(isConfirmWord("delete", "LÖSCHEN")).toBe(true);
        expect(isConfirmWord("LÖSCH", "LÖSCHEN")).toBe(false);
        expect(isConfirmWord("", "")).toBe(false);
    });
});
