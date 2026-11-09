import { describe, expect, it } from "vitest";
import { createEmptyResume } from "../schema";
import { createNewResume, DEFAULT_TEMPLATE_ID, withDefaultDesign } from "./default-design";
import { getBuiltinTemplateById } from "./enginecv-templates";

describe("default design", () => {
    const modern = getBuiltinTemplateById(DEFAULT_TEMPLATE_ID)!;

    it("starts new resumes from the Modern template, not the schema defaults", () => {
        const resume = createNewResume();

        expect(DEFAULT_TEMPLATE_ID).toBe("enginecv-modern");
        expect(resume.settings.colors).toEqual(modern.settings.colors);
        expect(resume.settings.typography.fontFamily).toBe(modern.settings.typography.fontFamily);
        expect(resume.settings.colors.accent).not.toBe(createEmptyResume().settings.colors.accent);
    });

    it("keeps the resume's own content, language and sections when applying the design", () => {
        const source = createEmptyResume();
        source.basics.name = "Jane Doe";
        source.settings.language = "de";
        source.settings.contentSections = ["experience", "skills"];

        const designed = withDefaultDesign(source);

        expect(designed.basics.name).toBe("Jane Doe");
        expect(designed.settings.language).toBe("de");
        expect(designed.settings.contentSections).toEqual(["experience", "skills"]);
        expect(designed.settings.colors).toEqual(modern.settings.colors);
    });
});
