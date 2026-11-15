import { describe, expect, it } from "vitest";
import { createEmptyResume, resumeSchema, SKILL_LEVELS } from "@/lib/schema";
import {
    getSkillLevelWord,
    isDefaultSkillsSection,
    parseSkillLevel,
    resolveSkillsSection,
    resolveSkillsSectionForTemplate,
    skillLevelNumber,
} from "./levels";

describe("skill level words", () => {
    it("parses the five known levels and treats everything else as no level", () => {
        for (const level of SKILL_LEVELS) expect(parseSkillLevel(level)).toBe(level);
        for (const bad of ["", "guru", "EXPERT", null, undefined, 4, {}]) expect(parseSkillLevel(bad)).toBeNull();
    });

    it("numbers levels 1 to 5 and gives 0 for none", () => {
        expect(SKILL_LEVELS.map(skillLevelNumber)).toEqual([1, 2, 3, 4, 5]);
        expect(skillLevelNumber("")).toBe(0);
        expect(skillLevelNumber("nonsense")).toBe(0);
    });

    it("names every level in the CV language, with English as the fallback", () => {
        expect(getSkillLevelWord("expert", "en")).toBe("Expert");
        expect(getSkillLevelWord("beginner", "de")).toBe("Anfänger");
        expect(getSkillLevelWord("proficient", "bs")).toBe("Vješt");
        expect(getSkillLevelWord("expert", "de-AT")).toBe("Experte");
        expect(getSkillLevelWord("expert", "xx")).toBe("Expert");
        expect(getSkillLevelWord("", "en")).toBe("");
        expect(getSkillLevelWord("nope", "de")).toBe("");
    });

    it("has five distinct non-empty words for every supported language", () => {
        for (const language of ["en", "bs", "hr", "sr", "de", "es", "fr", "it", "pt", "nl", "pl", "cs", "sk", "sl", "ro", "hu", "tr", "sq", "fi", "sv", "no", "da"]) {
            const words = SKILL_LEVELS.map((level) => getSkillLevelWord(level, language));
            expect(words.every(Boolean), language).toBe(true);
            expect(new Set(words).size, language).toBe(5);
        }
    });
});

describe("skills section settings", () => {
    it("defaults to dots, on, and recovers from bad stored values", () => {
        const fresh = createEmptyResume();
        expect(fresh.settings.skillsSection).toEqual({ showLevels: true, levelStyle: "dots" });

        const hand = resumeSchema.parse({ ...createEmptyResume(), settings: { ...createEmptyResume().settings, skillsSection: { showLevels: "yes", levelStyle: "pie" } } });
        expect(hand.settings.skillsSection).toEqual({ showLevels: true, levelStyle: "dots" });

        const old = createEmptyResume();
        delete (old.settings as Record<string, unknown>).skillsSection;
        expect(resumeSchema.parse(old).settings.skillsSection).toEqual({ showLevels: true, levelStyle: "dots" });
    });

    it("applies a section override on top of the CV-wide setting", () => {
        const resume = createEmptyResume();
        resume.settings.skillsSection = { showLevels: true, levelStyle: "bar" };
        expect(resolveSkillsSection(resume)).toEqual({ showLevels: true, levelStyle: "bar" });

        resume.customization.sectionOverrides.skills = { skillsSection: { showLevels: false } };
        expect(resolveSkillsSection(resume)).toEqual({ showLevels: false, levelStyle: "bar" });
        expect(resolveSkillsSection(resume, "skills:2")).toEqual({ showLevels: false, levelStyle: "bar" });
    });

    it("lets a template change the meter only when it deliberately differs from the default", () => {
        const chosen = { showLevels: true, levelStyle: "number" as const };
        expect(isDefaultSkillsSection({ showLevels: true, levelStyle: "dots" })).toBe(true);
        expect(resolveSkillsSectionForTemplate(chosen, { showLevels: true, levelStyle: "dots" })).toBe(chosen);
        expect(resolveSkillsSectionForTemplate(chosen, { showLevels: false, levelStyle: "dots" })).toEqual({ showLevels: false, levelStyle: "dots" });
    });
});
