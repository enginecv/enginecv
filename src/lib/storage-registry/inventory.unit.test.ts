import { describe, expect, it } from "vitest";
import { collectInventory, isInventoryEmpty, parseCookies } from "./inventory";
import { MemoryStorage, seededAdapters } from "./__fixtures__/adapters";

describe("collectInventory", () => {
    it("lists every stored item and matches it to the registry", async () => {
        const inventory = await collectInventory(seededAdapters());
        const byName = Object.fromEntries(inventory.items.map((item) => [`${item.location}:${item.name}`, item]));

        expect(byName["indexeddb-database:EngineCVDatabase"].entry?.id).toBe("idb.database");
        expect(byName["indexeddb-table:resumes"].count).toBe(3);
        expect(byName["indexeddb-table:resumeHistory"].count).toBe(2);
        expect(byName["local-storage:enginecv-preferences"].entry?.id).toBe("ls.preferences");
        expect(byName["cookie:enginecv-locale"].entry?.id).toBe("cookie.locale");
    });

    it("flags items EngineCV does not know instead of hiding them", async () => {
        const inventory = await collectInventory(seededAdapters());
        const foo = inventory.items.find((item) => item.name === "foo");
        expect(foo).toBeDefined();
        expect(foo?.entry).toBeNull();
    });

    it("reports change times where the stored value has one, and nothing otherwise", async () => {
        const inventory = await collectInventory(seededAdapters());
        const find = (name: string) => inventory.items.find((item) => item.name === name);

        expect(find("enginecv-preferences")?.updatedAt).toBe("2026-10-27T10:00:00.000Z");
        expect(find("enginecv-consent")?.updatedAt).toBe("2026-10-01T09:00:00.000Z");
        expect(find("resumes")?.updatedAt).toBe(new Date(Date.UTC(2026, 9, 22)).toISOString());
        expect(find("foo")?.updatedAt).toBeUndefined();
        expect(find("enginecv-locale")?.updatedAt).toBeUndefined();
    });

    it("counts CVs, versions, templates and other items", async () => {
        const inventory = await collectInventory(seededAdapters());
        expect(inventory.counts).toEqual({ resumes: 3, versions: 2, templates: 0, other: 4 });
        expect(inventory.totalBytes).toBeGreaterThan(0);
    });

    it("lists third-party cookies it cannot see", async () => {
        const inventory = await collectInventory(seededAdapters());
        expect(inventory.invisible.map((entry) => entry.name)).toContain("__cf_bm");
    });

    it("reports locations the browser refused to read", async () => {
        const inventory = await collectInventory(seededAdapters({ localStorage: null }));
        expect(inventory.unreadable).toContain("local-storage");
    });

    it("never opens the database when it does not exist", async () => {
        let opened = false;
        const inventory = await collectInventory(seededAdapters({
            indexedDB: { databases: async () => [] },
            localStorage: new MemoryStorage(),
            cookies: () => "",
            readEngineCvContent: async () => {
                opened = true;
                return { resumes: [], resumeHistory: [], templates: [] };
            },
        }));
        expect(opened).toBe(false);
        expect(isInventoryEmpty(inventory)).toBe(true);
    });

    it("falls back to a direct existence check where databases() is missing", async () => {
        const inventory = await collectInventory(seededAdapters({ indexedDB: null, databaseExists: async () => true }));
        expect(inventory.counts.resumes).toBe(3);
    });
});

describe("parseCookies", () => {
    it("splits names and values", () => {
        expect(parseCookies("a=1; b=two=2;  c")).toEqual({ a: "1", b: "two=2", c: "" });
    });
});
