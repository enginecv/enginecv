import { describe, expect, it } from "vitest";
import { getBuiltinTemplateById, getBuiltinTemplates } from "@/lib/templates/enginecv-templates";
import { applyTemplateToResume } from "@/lib/templates/template-apply";
import { isDefaultInterestsSection, resolveInterestsSectionForTemplate } from "./settings";
import {
    DEFAULT_INTERESTS_SECTION,
    SECTION_STYLE_KEYS,
    createEmptyResume,
    interestsSectionSchema,
    resumeSchema,
} from "@/lib/schema";

describe("interestsSection settings", () => {
    it("defaults to today's list look so existing CVs do not change", () => {
        expect(DEFAULT_INTERESTS_SECTION).toEqual({
            display: "list",
            showIcons: true,
            columns: 3,
            separator: "dot",
        });
        const settings = createEmptyResume().settings;
        expect(settings.interestsSection).toEqual(DEFAULT_INTERESTS_SECTION);
        // Each resume gets its own copy, never the shared constant.
        expect(settings.interestsSection).not.toBe(DEFAULT_INTERESTS_SECTION);
    });

    it("fills defaults when an older resume has no interestsSection key", () => {
        const resume = createEmptyResume();
        const legacy = JSON.parse(JSON.stringify(resume));
        delete legacy.settings.interestsSection;

        const parsed = resumeSchema.parse(legacy);

        expect(parsed.settings.interestsSection).toEqual(DEFAULT_INTERESTS_SECTION);
    });

    it("keeps valid values and fills the rest of a partial object", () => {
        expect(interestsSectionSchema.parse({ display: "chips" })).toEqual({
            ...DEFAULT_INTERESTS_SECTION,
            display: "chips",
        });
        expect(interestsSectionSchema.parse({ display: "iconGrid", columns: 2, showIcons: false, separator: "pipe" })).toEqual({
            display: "iconGrid",
            columns: 2,
            showIcons: false,
            separator: "pipe",
        });
    });

    it("falls back to defaults for unknown or out-of-range values instead of failing", () => {
        const parsed = interestsSectionSchema.parse({
            display: "cards",
            columns: 9,
            showIcons: "yes",
            separator: "star",
        });

        expect(parsed).toEqual(DEFAULT_INTERESTS_SECTION);
        expect(interestsSectionSchema.parse({ columns: 0 }).columns).toBe(3);
        expect(interestsSectionSchema.parse({ columns: 2.5 }).columns).toBe(3);
    });

    it("is available as a per-section style override like languagesSection", () => {
        expect(SECTION_STYLE_KEYS).toContain("interestsSection");
    });
});

describe("applying a template to the Interests section", () => {
    const chosen = { display: "chips", showIcons: true, columns: 3, separator: "dot" } as const;

    it("keeps the user's style when the template leaves Interests at the default", () => {
        expect(resolveInterestsSectionForTemplate(chosen, DEFAULT_INTERESTS_SECTION)).toEqual(chosen);
        expect(isDefaultInterestsSection(DEFAULT_INTERESTS_SECTION)).toBe(true);
    });

    it("uses the template's style when it deliberately differs from the default", () => {
        const plain = { ...DEFAULT_INTERESTS_SECTION, showIcons: false };
        expect(isDefaultInterestsSection(plain)).toBe(false);
        expect(resolveInterestsSectionForTemplate(chosen, plain)).toEqual(plain);
    });

    it("applyTemplateToResume keeps a chosen style for ordinary templates and turns icons off for ATS Plain", () => {
        const resume = createEmptyResume();
        resume.settings.interestsSection = { ...chosen };

        const modern = getBuiltinTemplateById("enginecv-modern") ?? getBuiltinTemplates()[0];
        const afterModern = applyTemplateToResume(resume, modern).resume;
        expect(afterModern.settings.interestsSection).toEqual(chosen);

        const ats = getBuiltinTemplateById("enginecv-compact");
        expect(ats).toBeDefined();
        const afterAts = applyTemplateToResume(afterModern, ats!).resume;
        expect(afterAts.settings.interestsSection).toEqual({
            display: "list",
            showIcons: false,
            columns: 3,
            separator: "dot",
        });
    });
});
