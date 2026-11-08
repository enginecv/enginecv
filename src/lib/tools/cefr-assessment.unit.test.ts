import { describe, expect, it } from "vitest";
import { deriveOverallCefrLevel } from "@/lib/cefr";
import { createEmptyResume, languageSchema, resumeSchema } from "@/lib/schema";
import {
    assessmentToLanguage,
    canShowResult,
    mergeAssessmentIntoResume,
    resumeFromAssessment,
    type LanguageSelfAssessment,
} from "@/lib/tools/cefr-assessment";

const partial: LanguageSelfAssessment = {
    language: " German ",
    levels: { listening: "B2", reading: "B2", spokenInteraction: "B1", spokenProduction: "B1" },
};

function resumeWith(...languages: Array<Record<string, unknown>>) {
    return { ...createEmptyResume(), languages: languages.map((language) => languageSchema.parse(language)) };
}

describe("CEFR self-assessment", () => {
    it("needs a language and at least one assessed skill", () => {
        expect(canShowResult({ language: "", levels: { reading: "A2" } })).toBe(false);
        expect(canShowResult({ language: "German", levels: {} })).toBe(false);
        expect(canShowResult({ language: "x".repeat(61), levels: { reading: "A2" } })).toBe(false);
        expect(canShowResult({ language: "German", levels: { reading: "A2" } })).toBe(true);
    });

    it("keeps skipped skills empty and derives the overall level with the CV's rule", () => {
        const entry = assessmentToLanguage(partial);
        expect(entry).toMatchObject({ language: "German", cefrDetailed: true, assessmentType: "self" });
        expect(entry.cefr).toEqual({ listening: "B2", reading: "B2", spokenInteraction: "B1", spokenProduction: "B1", writing: "" });
        expect(entry.fluency).toBe(deriveOverallCefrLevel(entry.cefr));
        expect(entry.fluency).toBe("B1");
    });

    it("appends a language the resume does not list", () => {
        const { resume, outcome } = mergeAssessmentIntoResume(resumeWith({ language: "English", fluency: "C1" }), assessmentToLanguage(partial));
        expect(outcome).toBe("appended");
        expect(resume.languages.map((language) => language.language)).toEqual(["English", "German"]);
        expect(() => resumeSchema.parse(resume)).not.toThrow();
    });

    it("updates the levels of the same language, matched without case or spaces, and keeps its other fields", () => {
        const original = resumeWith({ language: "german", fluency: "A2", description: "Goethe course", hidden: true });
        const { resume, outcome } = mergeAssessmentIntoResume(original, assessmentToLanguage(partial));

        expect(outcome).toBe("updated");
        expect(resume.languages).toHaveLength(1);
        expect(resume.languages[0]).toMatchObject({
            id: original.languages[0].id,
            language: "german",
            description: "Goethe course",
            hidden: true,
            fluency: "B1",
            cefrDetailed: true,
            assessmentType: "self",
        });
    });

    it("never overwrites a mother tongue", () => {
        const original = resumeWith({ language: "German", fluency: "Native" });
        const { resume, outcome } = mergeAssessmentIntoResume(original, assessmentToLanguage(partial));
        expect(outcome).toBe("native");
        expect(resume).toBe(original);
    });

    it("builds a new resume that shows the language in the CEFR grid", () => {
        const resume = resumeSchema.parse(resumeFromAssessment(assessmentToLanguage(partial)));
        expect(resume.languages).toHaveLength(1);
        expect(resume.settings.sectionDisplay.languages?.languageLayout).toBe("cefr");
    });
});
