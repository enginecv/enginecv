import { describe, expect, it } from "vitest";
import { createEmptyResume, type Resume } from "../schema";
import { applyTemplateToResume } from "./template-apply";
import {
    templateDocumentSchema,
    type TemplateDocument,
    TEMPLATE_DOCUMENT_VERSION,
} from "./template-schema";

function buildTemplate(overrides: Partial<TemplateDocument["settings"]> = {}, paperSize: "a4" | "letter" = "letter"): TemplateDocument {
    const empty = createEmptyResume();
    const now = Date.now();
    return {
        kind: "template",
        id: "tpl-1",
        version: TEMPLATE_DOCUMENT_VERSION,
        meta: { name: "Test", description: "", tags: [], source: "user" },
        settings: { ...empty.settings, ...overrides },
        paperSize,
        createdAt: now,
        updatedAt: now,
    };
}

function buildResume(overrides: Partial<Resume> = {}): Resume {
    return { ...createEmptyResume(), ...overrides };
}

describe("applyTemplateToResume", () => {
    it("replaces visual settings with template values", () => {
        const resume = buildResume();
        const template = buildTemplate({
            colors: { ...resume.settings.colors, accent: "#123456" },
            typography: { ...resume.settings.typography, fontFamily: "Merriweather", fontSize: 12, lineHeight: 1.5 },
        });

        const { resume: next } = applyTemplateToResume(resume, template);

        expect(next.settings.colors.accent).toBe("#123456");
        expect(next.settings.typography.fontFamily).toBe("Merriweather");
        expect(next.settings.typography.fontSize).toBe(12);
    });

    it("preserves user/environment preferences excluded by the plan", () => {
        const resume = buildResume({
            settings: {
                ...createEmptyResume().settings,
                language: "fr",
                dateFormat: "YYYY-MM-DD",
                measurementSystem: "imperial",
                ai: {
                    mode: "content",
                    provider: "openai",
                    localModel: "Xenova/TinyLlama-1.1B-Chat-v1.0",
                    model: "gpt-4o",
                },
            },
        });

        const template = buildTemplate({
            language: "es",
            dateFormat: "DD-MM-YYYY",
            measurementSystem: "metric",
            ai: {
                mode: "plan",
                provider: "local",
                localModel: "Xenova/Other",
                model: "",
            },
        });

        const { resume: next } = applyTemplateToResume(resume, template);

        expect(next.settings.language).toBe("fr");
        expect(next.settings.dateFormat).toBe("YYYY-MM-DD");
        expect(next.settings.measurementSystem).toBe("imperial");
        expect(next.settings.ai.provider).toBe("openai");
        expect(next.settings.ai.model).toBe("gpt-4o");
    });

    it("preserves the resume's content section set", () => {
        const resume = buildResume({
            settings: {
                ...createEmptyResume().settings,
                contentSections: ["awards", "publications"],
            },
        });

        const template = buildTemplate({
            contentSections: ["volunteering"],
        });

        const { resume: next } = applyTemplateToResume(resume, template);

        expect(next.settings.contentSections).toEqual(["awards", "publications"]);
    });

    it("orders sections by template intent then appends resume-only keys", () => {
        const resume = buildResume({
            settings: {
                ...createEmptyResume().settings,
                contentSections: ["awards"],
                layout: {
                    ...createEmptyResume().settings.layout,
                    sectionOrder: ["experience", "education", "awards", "skills"],
                },
            },
        });

        const template = buildTemplate({
            layout: {
                ...createEmptyResume().settings.layout,
                sectionOrder: ["education", "experience", "ghost-section", "skills"],
            },
        });

        const { resume: next } = applyTemplateToResume(resume, template);

        expect(next.settings.layout.sectionOrder).toEqual([
            "education",
            "experience",
            "skills",
            "awards",
        ]);
    });

    it("ignores section placements for sections that do not exist on the resume", () => {
        const resume = buildResume({
            settings: {
                ...createEmptyResume().settings,
                contentSections: ["awards"],
                layout: {
                    ...createEmptyResume().settings.layout,
                    sectionPlacement: { experience: "left" },
                },
            },
        });

        const template = buildTemplate({
            layout: {
                ...createEmptyResume().settings.layout,
                sectionPlacement: { experience: "right", "ghost-section": "left", awards: "full" },
            },
        });

        const { resume: next } = applyTemplateToResume(resume, template);

        expect(next.settings.layout.sectionPlacement).toEqual({
            experience: "right",
            awards: "full",
        });
        expect(next.settings.layout.sectionPlacement).not.toHaveProperty("ghost-section");
    });

    it("returns paperSize only when applyPaperSize is set", () => {
        const resume = buildResume();
        const template = buildTemplate({}, "letter");

        const without = applyTemplateToResume(resume, template);
        const withFlag = applyTemplateToResume(resume, template, { applyPaperSize: true });

        expect(without.paperSize).toBeUndefined();
        expect(withFlag.paperSize).toBe("letter");
    });

    it("merges custom fonts by name with template wins", () => {
        const resume = buildResume({
            settings: {
                ...createEmptyResume().settings,
                customFonts: [
                    { name: "MyFont", url: "https://example.com/old.woff2" },
                    { name: "ResumeOnly", url: "https://example.com/keep.woff2" },
                ],
            },
        });

        const template = buildTemplate({
            customFonts: [{ name: "MyFont", url: "https://example.com/new.woff2" }],
        });

        const { resume: next } = applyTemplateToResume(resume, template);
        const fonts = next.settings.customFonts;
        expect(fonts).toHaveLength(2);
        expect(fonts.find((f) => f.name === "MyFont")?.url).toBe("https://example.com/new.woff2");
        expect(fonts.find((f) => f.name === "ResumeOnly")?.url).toBe("https://example.com/keep.woff2");
    });
});

describe("templateDocumentSchema", () => {
    it("parses a minimal payload with defaults", () => {
        const result = templateDocumentSchema.safeParse({
            kind: "template",
            id: "tpl-min",
            version: 1,
            meta: { name: "Min" },
            settings: createEmptyResume().settings,
            paperSize: "a4",
            createdAt: 0,
            updatedAt: 0,
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.meta.source).toBe("user");
            expect(result.data.meta.tags).toEqual([]);
        }
    });

    it("rejects an unrelated object", () => {
        const result = templateDocumentSchema.safeParse({ kind: "resume" });
        expect(result.success).toBe(false);
    });
});
