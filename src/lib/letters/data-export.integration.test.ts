import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { importResumeFromJsonText } from "@/lib/export";
import { readSourceFile } from "@/lib/import/read-source";
import { createEmptyResume } from "@/lib/schema";
import { MemoryStorage, seededAdapters } from "@/lib/storage-registry/__fixtures__/adapters";
import { buildDataExport, DATA_EXPORT_FORMAT } from "@/lib/storage-registry/export-file";
import { collectInventory } from "@/lib/storage-registry/inventory";
import { en } from "@/lib/storage-registry/messages/en";
import { formatStorageMessage } from "@/lib/storage-registry/messages";
import { makeCv, makeLetter, makeSentLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { paragraphEntrySchema } from "./schema";
import { MISSING_CV_PREFIX } from "./import";
import { getLetter, importDataExport, listLetters, listParagraphs } from "./store";

const ts = (key: string, params?: Record<string, string | number>) => formatStorageMessage(en, key, params);
const context = { ts, locale: "en" as const, appVersion: "1.0.0", origin: "https://enginecv.app", now: new Date("2026-11-18T10:00:00.000Z") };

/** A data-export file for a browser that holds two CVs and letters of every kind. */
async function exportFile() {
    const cvA = makeCv({ id: "cv-a", title: "Design CV", name: "Anna" });
    const cvB = makeCv({ id: "cv-b", title: "Research CV", name: "Bela" });
    const letters = [
        makeLetter({ id: "draft-a", cvId: "cv-a", company: "Acme", senderOverrides: { email: "work@acme.test" } }),
        makeLetter({ id: "draft-b", cvId: "cv-b", company: "Globex" }),
        makeSentLetter({ id: "sent-a", cvId: "cv-a", senderName: "Anna Sent", company: "Sent Co" }),
        makeLetter({ id: "orphan", cvId: "cv-deleted", company: "Initech" }),
    ];
    const paragraphs = [paragraphEntrySchema.parse({ id: "lib-1", name: "Closing", markdown: "Thank you for your time." })];
    const adapters = seededAdapters({
        localStorage: new MemoryStorage(),
        readEngineCvContent: async () => ({ resumes: [cvA, cvB], resumeHistory: [], templates: [], coverLetters: letters, letterParagraphs: paragraphs }),
    });
    return buildDataExport(await collectInventory(adapters), context);
}

function asFile(file: unknown): File {
    return new File([JSON.stringify(file)], "enginecv-data.json", { type: "application/json" });
}

describe("letters in the data export", () => {
    beforeEach(async () => {
        await resetLetterTables();
    });

    it("includes the letters and the saved paragraphs, and lists the tables in the file's inventory", async () => {
        const file = await exportFile();
        const database = file.data.indexedDB.EngineCVDatabase;
        expect(database.coverLetters).toHaveLength(4);
        expect(database.letterParagraphs).toHaveLength(1);
        expect(file.items.map((item) => item.name)).toEqual(expect.arrayContaining(["coverLetters", "letterParagraphs"]));
        expect(file.format).toBe(DATA_EXPORT_FORMAT);
    });

    it("reads the letters back out through the importer", async () => {
        const text = JSON.stringify(await exportFile());
        const result = await importResumeFromJsonText(text);
        expect(result?.kind).toBe("data-export");
        if (result?.kind !== "data-export") return;
        expect(result.resumes).toHaveLength(2);
        expect(result.extras.letters).toHaveLength(4);
        expect(result.extras.paragraphs).toHaveLength(1);
    });

    it("hands the letters to the first staged CV only", async () => {
        const batches = await readSourceFile(asFile(await exportFile()));
        expect(batches).toHaveLength(2);
        expect(batches[0].dataExportExtras?.letters).toHaveLength(4);
        expect(batches[1].dataExportExtras).toBeUndefined();
    });

    it("restores everything into an empty app: CVs with new ids, letters linked to the new CVs, sent state and the library intact", async () => {
        const batches = await readSourceFile(asFile(await exportFile()));
        const result = await importDataExport(batches.map((batch) => batch.resume), batches[0].dataExportExtras, 1000);

        expect(result).toEqual({ resumesAdded: 2, lettersAdded: 4, paragraphsAdded: 1, orphanedDrafts: 1 });
        const cvs = await db.resumes.toArray();
        expect(cvs.every((cv) => cv.id !== "cv-a" && cv.id !== "cv-b")).toBe(true);
        const idByName = Object.fromEntries(cvs.map((cv) => [cv.basics.name, cv.id]));

        const byCompany = new Map((await listLetters()).map((letter) => [letter.company, letter]));
        expect(byCompany.get("Acme")).toMatchObject({ status: "draft", cvId: idByName.Anna, senderOverrides: { email: "work@acme.test" } });
        expect(byCompany.get("Globex")).toMatchObject({ status: "draft", cvId: idByName.Bela });
        const sent = (await listLetters()).find((letter) => letter.status === "sent");
        expect(sent).toMatchObject({ cvId: idByName.Anna });
        expect(sent?.frozen?.sender.name).toBe("Anna Sent");
        expect((await listParagraphs()).map((entry) => entry.name)).toEqual(["Closing"]);
    });

    it("keeps a draft whose CV was not in the file, so it can be linked or kept as a snapshot", async () => {
        const batches = await readSourceFile(asFile(await exportFile()));
        await importDataExport(batches.map((batch) => batch.resume), batches[0].dataExportExtras);
        const orphan = (await listLetters()).find((letter) => letter.company === "Initech");
        expect(orphan?.status).toBe("draft");
        expect(orphan?.cvId?.startsWith(MISSING_CV_PREFIX)).toBe(true);
        expect(await db.resumes.get(orphan!.cvId!)).toBeUndefined();
    });

    it("adds to an app that already has letters, never overwriting them, and does not duplicate saved paragraphs on a second import", async () => {
        await db.resumes.put(makeCv({ id: "mine" }));
        await db.coverLetters.put(makeLetter({ id: "existing", cvId: "mine", company: "Mine" }));
        const before = await getLetter("existing");

        const batches = await readSourceFile(asFile(await exportFile()));
        await importDataExport(batches.map((batch) => batch.resume), batches[0].dataExportExtras);
        await importDataExport(batches.map((batch) => batch.resume), batches[0].dataExportExtras);

        expect(await getLetter("existing")).toEqual(before);
        expect((await listLetters()).filter((letter) => letter.company === "Mine")).toHaveLength(1);
        expect(await db.coverLetters.count()).toBe(1 + 4 + 4);
        expect(await listParagraphs()).toHaveLength(1);
    });

    it("imports a file without letters exactly as before", async () => {
        const result = await importDataExport([{ ...createEmptyResume(), id: "x" }], undefined);
        expect(result).toEqual({ resumesAdded: 1, lettersAdded: 0, paragraphsAdded: 0, orphanedDrafts: 0 });
        expect(await db.resumes.count()).toBe(1);
    });

    it("leaves nothing half imported when saving the letters fails", async () => {
        const batches = await readSourceFile(asFile(await exportFile()));
        const spy = vi.spyOn(db.coverLetters, "bulkAdd").mockRejectedValueOnce(new Error("disk full"));
        await expect(importDataExport(batches.map((batch) => batch.resume), batches[0].dataExportExtras)).rejects.toThrow();
        spy.mockRestore();
        expect(await db.resumes.count()).toBe(0);
        expect(await db.coverLetters.count()).toBe(0);
    });
});
