import { CEFR_SKILLS, deriveOverallCefrLevel, emptyCefrSkillLevels, type CefrLevel, type CefrSkill } from "@/lib/cefr";
import { isNativeLanguageFluency, languageSchema, type Language, type Resume } from "@/lib/schema";
import { createNewResume } from "@/lib/templates/default-design";

export const MAX_LANGUAGE_NAME_LENGTH = 60;

/** A visitor's answers on the CEFR tool: a language and at most one level per skill. */
export interface LanguageSelfAssessment {
    language: string;
    /** A missing skill was skipped. */
    levels: Partial<Record<CefrSkill, CefrLevel>>;
}

export type MergeOutcome = "appended" | "updated" | "native";

/** A result needs a language name and at least one assessed skill. */
export function canShowResult(assessment: LanguageSelfAssessment): boolean {
    const name = assessment.language.trim();
    return name.length > 0
        && name.length <= MAX_LANGUAGE_NAME_LENGTH
        && CEFR_SKILLS.some((skill) => assessment.levels[skill] !== undefined);
}

/** The languages-section entry for an assessment, with the overall level the CV grid uses. */
export function assessmentToLanguage(assessment: LanguageSelfAssessment): Language {
    const cefr = { ...emptyCefrSkillLevels(), ...assessment.levels };
    return languageSchema.parse({
        language: assessment.language.trim(),
        fluency: deriveOverallCefrLevel(cefr),
        cefrDetailed: true,
        cefr,
        assessmentType: "self",
    });
}

function sameLanguage(a: string, b: string): boolean {
    return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
}

/**
 * Adds an assessed language to a resume, or updates the levels of the entry
 * with the same name. A mother tongue is never replaced by a self-assessment.
 */
export function mergeAssessmentIntoResume(resume: Resume, entry: Language): { resume: Resume; outcome: MergeOutcome } {
    const index = resume.languages.findIndex((language) => sameLanguage(language.language, entry.language));
    if (index === -1) {
        return { resume: { ...resume, languages: [...resume.languages, entry] }, outcome: "appended" };
    }

    const existing = resume.languages[index];
    if (isNativeLanguageFluency(existing.fluency)) return { resume, outcome: "native" };

    const languages = resume.languages.slice();
    languages[index] = {
        ...existing,
        fluency: entry.fluency,
        cefrDetailed: true,
        cefr: entry.cefr,
        assessmentType: "self",
    };
    return { resume: { ...resume, languages }, outcome: "updated" };
}

/** A new resume holding only the assessed language, shown in the CEFR grid layout. */
export function resumeFromAssessment(entry: Language): Resume {
    const base = createNewResume();
    return {
        ...base,
        languages: [entry],
        settings: {
            ...base.settings,
            sectionDisplay: { ...base.settings.sectionDisplay, languages: { languageLayout: "cefr" } },
        },
    };
}
