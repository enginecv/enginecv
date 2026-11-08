import { describe, expect, it } from "vitest";
import {
    CV_LANGUAGE_OPTIONS,
    formatCvDate,
    getCvLanguageLabels,
    getDefaultCvDateFormat,
} from "./cv-language";

describe("formatCvDate", () => {
    it("formats month-only resume dates without inventing a day", () => {
        expect(formatCvDate("2025-05", "DD/MM/YYYY", "en")).toBe("05/2025");
        expect(formatCvDate("2025-05", "MMM DD, YYYY", "en")).toBe("May 2025");
    });

    it("formats year-only resume dates as just the year", () => {
        expect(formatCvDate("2025", "DD/MM/YYYY", "en")).toBe("2025");
        expect(formatCvDate("2025", "MMMM Do, YYYY", "en")).toBe("2025");
    });
});

describe("getDefaultCvDateFormat", () => {
    it("chooses a language-compatible initial format", () => {
        expect(getDefaultCvDateFormat("en")).toBe("MM/DD/YYYY");
        expect(getDefaultCvDateFormat("bs")).toBe("DD.MM.YYYY");
        expect(getDefaultCvDateFormat("fr")).toBe("DD/MM/YYYY");
    });
});

describe("getCvLanguageLabels", () => {
    it("keeps newer resume-document labels in the CV-language catalog", () => {
        expect(getCvLanguageLabels("en")).toMatchObject({
            skills: "Skills",
            organisations: "Organisations",
            languageSelfAssessed: "Self-assessed",
        });
        expect(getCvLanguageLabels("bs")).toMatchObject({
            skills: "Vještine",
            organisations: "Organizacije",
            languageSelfAssessed: "Samoprocjena",
        });
    });

    it("provides document labels for every selectable CV language", () => {
        for (const option of CV_LANGUAGE_OPTIONS) {
            const labels = getCvLanguageLabels(option.value);
            expect(labels.skills, `${option.value} skills`).toBeTruthy();
            expect(labels.languages, `${option.value} languages`).toBeTruthy();
            expect(labels.languageAssessment, `${option.value} assessment`).toBeTruthy();
        }
    });
});
