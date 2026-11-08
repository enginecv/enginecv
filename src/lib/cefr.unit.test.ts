import { describe, expect, it } from "vitest";
import { assessedCefrSkills, cefrBand, deriveOverallCefrLevel, emptyCefrSkillLevels, hasUniformCefrLevels } from "./cefr";
import { languageSchema } from "./schema";

describe("deriveOverallCefrLevel", () => {
    it("takes the median, rounding down on even counts", () => {
        expect(deriveOverallCefrLevel({ listening: "C2", reading: "C2", spokenInteraction: "C1", spokenProduction: "C1", writing: "B2" })).toBe("C1");
        expect(deriveOverallCefrLevel({ listening: "A2", reading: "C1" })).toBe("A2");
        expect(deriveOverallCefrLevel({ writing: "B1" })).toBe("B1");
    });

    it("ignores unrated or invalid skills", () => {
        expect(deriveOverallCefrLevel(emptyCefrSkillLevels())).toBe("");
        expect(deriveOverallCefrLevel({ listening: "Native", reading: "b2", writing: "C1" })).toBe("C1");
        expect(deriveOverallCefrLevel(undefined)).toBe("");
    });
});

describe("CEFR helpers", () => {
    it("lists assessed skills in grid order and detects uniform grids", () => {
        const levels = { ...emptyCefrSkillLevels(), writing: "B1", listening: "B1" };
        expect(assessedCefrSkills(levels)).toEqual(["listening", "writing"]);
        expect(hasUniformCefrLevels(levels)).toBe(true);
        expect(hasUniformCefrLevels({ ...levels, reading: "C1" })).toBe(false);
    });

    it("names the CEFR user bands", () => {
        expect([cefrBand("A2"), cefrBand("B1"), cefrBand("C2")]).toEqual(["basic", "independent", "proficient"]);
    });
});

describe("languageSchema CEFR fields", () => {
    it("defaults older languages to a single level with an empty grid", () => {
        const parsed = languageSchema.parse({ language: "English", fluency: "B2" });
        expect(parsed.cefrDetailed).toBe(false);
        expect(parsed.cefr).toEqual(emptyCefrSkillLevels());
    });

    it("never keeps a mother tongue in detailed mode", () => {
        const parsed = languageSchema.parse({ language: "Bosnian", fluency: "Native", cefrDetailed: true, cefr: { listening: "C2" } });
        expect(parsed.cefrDetailed).toBe(false);
    });
});
