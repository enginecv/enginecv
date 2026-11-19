import { describe, expect, it } from "vitest";
import { baseLanguage, buildStarterContent, formatLetterDate, getLetterStarters } from "./starters";

describe("getLetterStarters", () => {
    it.each(["en", "de", "fr", "es", "bs"])("has a salutation, closing and subject wording for %s", (language) => {
        const starter = getLetterStarters(language);
        expect(starter.salutation).toBeTruthy();
        expect(starter.closing).toBeTruthy();
        expect(starter.subjectPrefix).toBeTruthy();
    });

    it("falls back to English for unknown languages and reads region codes", () => {
        expect(getLetterStarters("xx").salutation).toBe("Dear Hiring Manager,");
        expect(getLetterStarters("de-AT").salutation).toBe("Sehr geehrte Damen und Herren,");
        expect(baseLanguage("PT_br")).toBe("pt");
    });
});

describe("buildStarterContent", () => {
    it("starts with a single empty paragraph, not a fixed set: a letter has as many as it needs", () => {
        const content = buildStarterContent("en", "Designer");
        expect(content.paragraphs).toHaveLength(1);
        expect(content.paragraphs[0].markdown).toBe("");
        expect(content.subject).toBe("Application for Designer");
    });

    it("leaves the subject empty without a role", () => {
        expect(buildStarterContent("de").subject).toBe("");
        expect(buildStarterContent("de", "UX Designerin").subject).toBe("Bewerbung als UX Designerin");
    });
});

describe("formatLetterDate", () => {
    it("writes a long date in the letter's language, independent of the time zone", () => {
        expect(formatLetterDate("2026-11-18", "en")).toBe("November 18, 2026");
        expect(formatLetterDate("2026-11-18", "de")).toBe("18. November 2026");
    });

    it("returns text that is not an ISO date unchanged and survives a bad language code", () => {
        expect(formatLetterDate("tomorrow", "en")).toBe("tomorrow");
        expect(formatLetterDate("2026-11-18", "not a language")).toBe("November 18, 2026");
    });
});
