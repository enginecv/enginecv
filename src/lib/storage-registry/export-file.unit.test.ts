import { describe, expect, it } from "vitest";
import { resumeSchema } from "@/lib/schema";
import { MemoryStorage, seededAdapters } from "./__fixtures__/adapters";
import { buildDataExport, dataExportFileName, isDataExport, resumesFromDataExport, UNKNOWN } from "./export-file";
import { collectInventory } from "./inventory";
import { de } from "./messages/de";
import { en } from "./messages/en";
import { formatStorageMessage } from "./messages";

const tsEn = (key: string, params?: Record<string, string | number>) => formatStorageMessage(en, key, params);
const tsDe = (key: string, params?: Record<string, string | number>) => formatStorageMessage(de, key, params);
const context = { ts: tsEn, locale: "en" as const, appVersion: "1.2.3", origin: "https://enginecv.app", now: new Date("2026-10-28T20:00:00.000Z") };

describe("buildDataExport", () => {
    it("contains every item the page shows, annotated", async () => {
        const inventory = await collectInventory(seededAdapters());
        const file = buildDataExport(inventory, context);

        expect(file.items).toHaveLength(inventory.items.length);
        const preferences = file.items.find((item) => item.name === "enginecv-preferences");
        expect(preferences).toMatchObject({ registryId: "ls.preferences", legalBasis: "functional", owner: "EngineCV", updatedAt: "2026-10-27T10:00:00.000Z" });
    });

    it("says \"unknown\" instead of guessing times and owners", async () => {
        const file = buildDataExport(await collectInventory(seededAdapters()), context);
        const foo = file.items.find((item) => item.name === "foo");
        expect(foo).toMatchObject({ registryId: null, owner: UNKNOWN, updatedAt: UNKNOWN });
        expect(file.items.find((item) => item.name === "enginecv-locale")?.updatedAt).toBe(UNKNOWN);
    });

    it("holds the content itself, with versions as readable objects", async () => {
        const file = buildDataExport(await collectInventory(seededAdapters()), context);
        const database = file.data.indexedDB.EngineCVDatabase;
        expect(database.resumes).toHaveLength(3);
        const version = database.resumeHistory[0] as Record<string, unknown>;
        expect(version.resumeJson).toBeUndefined();
        expect(typeof version.resume).toBe("object");
        expect(file.data.localStorage.foo).toBe("bar");
        expect(file.data.localStorage["enginecv-consent"]).toMatchObject({ ads: "denied" });
        expect(file.data.cookies).toEqual({ "enginecv-locale": "de" });
    });

    it("explains itself in the interface language", async () => {
        const file = buildDataExport(await collectInventory(seededAdapters()), { ...context, ts: tsDe, locale: "de" });
        expect(file.summary[1]).toBe("Sie enthält 3 Lebensläufe, 2 gespeicherte Versionen, 0 Vorlagen, 4 weitere Einträge.");
        expect(file.serverSide[0]).toMatch(/^Keine Konten/);
        expect(file.notVisible.map((item) => item.name)).toContain("__cf_bm");
    });

    it("is recognised and gives back CVs that import", async () => {
        const file = buildDataExport(await collectInventory(seededAdapters()), context);
        const reparsed = JSON.parse(JSON.stringify(file));

        expect(isDataExport(reparsed)).toBe(true);
        const resumes = resumesFromDataExport(reparsed);
        expect(resumes).toHaveLength(3);
        for (const resume of resumes) expect(resumeSchema.safeParse(resume).success).toBe(true);
    });

    it("works for an empty browser", async () => {
        const inventory = await collectInventory(seededAdapters({
            indexedDB: { databases: async () => [] },
            localStorage: new MemoryStorage(),
            cookies: () => "",
        }));
        const file = buildDataExport(inventory, context);
        expect(file.items).toEqual([]);
        expect(resumesFromDataExport(file)).toEqual([]);
    });
});

describe("helpers", () => {
    it("names the file after the day", () => {
        expect(dataExportFileName(new Date("2026-10-28T23:00:00.000Z"))).toBe("enginecv-my-data-2026-10-28.json");
    });

    it("rejects other JSON", () => {
        expect(isDataExport({ basics: {} })).toBe(false);
        expect(isDataExport(null)).toBe(false);
    });
});

describe("large data (SC-005)", () => {
    it("reads and builds the file for the QA fixtures x20 with history in time", async () => {
        const { fixtureContent } = await import("./__fixtures__/adapters");
        const base = fixtureContent();
        const resumes = Array.from({ length: 20 }, () => base.resumes).flat();
        const resumeHistory = Array.from({ length: 20 }, (_, round) =>
            resumes.map((resume, index) => ({ id: round * resumes.length + index + 1, resumeId: resume.id ?? "x", createdAt: Date.now(), trigger: "autosave" as const, resumeJson: JSON.stringify(resume) })),
        ).flat().slice(0, 600);
        const adapters = seededAdapters({ readEngineCvContent: async () => ({ resumes, resumeHistory, templates: [] }) });

        const started = performance.now();
        const inventory = await collectInventory(adapters);
        const read = performance.now() - started;
        const file = buildDataExport(inventory, context);
        const text = JSON.stringify(file);
        const total = performance.now() - started;

        expect(inventory.counts).toMatchObject({ resumes: 60, versions: 600 });
        expect(text.length).toBeGreaterThan(1_000_000);
        expect(read).toBeLessThan(2_000);
        expect(total).toBeLessThan(10_000);
    });
});
