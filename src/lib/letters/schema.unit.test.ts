import { describe, expect, it } from "vitest";
import { makeCv, makeLetter, makeSentLetter } from "../../../test/setup/letter-fixtures";
import { createLetter, defaultPaperSize, letterDocumentSchema, todayIso } from "./schema";

describe("letterDocumentSchema invariants", () => {
    it("accepts a draft with a CV and no frozen copy", () => {
        expect(letterDocumentSchema.safeParse(makeLetter()).success).toBe(true);
    });

    it("rejects a draft without a CV", () => {
        expect(letterDocumentSchema.safeParse({ ...makeLetter(), cvId: null }).success).toBe(false);
    });

    it("rejects a frozen draft", () => {
        const sent = makeSentLetter();
        expect(letterDocumentSchema.safeParse({ ...sent, status: "draft" }).success).toBe(false);
    });

    it("requires a frozen copy for sent and snapshot letters, and lets them have no CV", () => {
        const sent = makeSentLetter({ cvId: null });
        expect(letterDocumentSchema.safeParse(sent).success).toBe(true);
        expect(letterDocumentSchema.safeParse({ ...sent, frozen: null }).success).toBe(false);
        expect(letterDocumentSchema.safeParse({ ...sent, status: "snapshot" }).success).toBe(true);
        expect(letterDocumentSchema.safeParse({ ...sent, status: "snapshot", frozen: null }).success).toBe(false);
    });

    it("rejects duplicate paragraph ids", () => {
        const letter = { ...makeLetter(), paragraphs: [{ id: "a", markdown: "x" }, { id: "a", markdown: "y" }] };
        expect(letterDocumentSchema.safeParse(letter).success).toBe(false);
    });

    it("keeps only the sender fields it knows as overrides", () => {
        const parsed = letterDocumentSchema.parse({ ...makeLetter(), senderOverrides: { email: "a@b.c", nonsense: "x" } });
        expect(parsed.senderOverrides).toEqual({ email: "a@b.c" });
    });
});

describe("createLetter", () => {
    it("links the CV, takes its language and today's date, and defaults to A4", () => {
        const cv = makeCv({ language: "en" });
        const now = new Date(2026, 10, 18, 12).getTime();
        const letter = createLetter(cv, { cvId: cv.id!, now });
        expect(letter).toMatchObject({ cvId: cv.id!, status: "draft", language: "en", layout: "standard", paperSize: "a4", date: "2026-11-18", frozen: null });
    });

    it("preselects the German layout on A4 for German letters and remembers the earlier size", () => {
        const cv = makeCv({ language: "de" });
        const letter = createLetter(cv, { cvId: cv.id! });
        expect(letter).toMatchObject({ language: "de", layout: "din5008", paperSize: "a4", paperSizeBeforeGerman: "a4" });
    });

    it("uses US Letter for English with a US region", () => {
        expect(defaultPaperSize("en-US")).toBe("letter");
        expect(defaultPaperSize("en")).toBe("a4");
        expect(defaultPaperSize("de")).toBe("a4");
    });

    it("lets the language differ from the CV", () => {
        const cv = makeCv({ language: "en" });
        expect(createLetter(cv, { cvId: cv.id!, language: "fr" }).language).toBe("fr");
    });

    it("formats today as an ISO date", () => {
        expect(todayIso(new Date(2026, 0, 5, 10).getTime())).toBe("2026-01-05");
    });
});
