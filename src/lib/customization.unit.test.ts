import { describe, expect, it } from "vitest";
import {
    hasSectionStyleOverride,
    resolveSectionSettings,
    withoutSectionStyleOverride,
} from "./customization";
import { createEmptyResume, resumeSchema } from "./schema";

describe("section customization", () => {
    it("adds an empty v2 customization model while parsing older resumes", () => {
        const resume = resumeSchema.parse({ version: 1 });

        expect(resume.customization).toEqual({
            version: 2,
            sectionOverrides: {},
        });
    });

    it("deep-merges local values over global settings without mutating globals", () => {
        const resume = createEmptyResume();
        const globalBorder = resume.settings.headings.border;
        const resolved = resolveSectionSettings(resume.settings, {
            headings: {
                fontSize: 18,
                border: {
                    width: 4,
                },
            },
            entryLayout: {
                layout: "singleCol",
            },
        });

        expect(resolved.headings.fontSize).toBe(18);
        expect(resolved.headings.border.width).toBe(4);
        expect(resolved.headings.border.bottom).toBe(globalBorder.bottom);
        expect(resolved.entryLayout.layout).toBe("singleCol");
        expect(resume.settings.headings.fontSize).toBe(14);
        expect(resume.settings.headings.border.width).toBe(2);
    });

    it("removes one local group while preserving other section overrides", () => {
        const resume = createEmptyResume();
        resume.customization.sectionOverrides.experience = {
            headings: { fontSize: 18 },
            contentStyle: { backgroundColor: "#ffffff" },
        };

        expect(hasSectionStyleOverride(resume, "experience", "headings")).toBe(true);

        const next = withoutSectionStyleOverride(
            resume.customization.sectionOverrides,
            "experience",
            "headings",
        );

        expect(next.experience?.headings).toBeUndefined();
        expect(next.experience?.contentStyle).toEqual({ backgroundColor: "#ffffff" });
    });
});
