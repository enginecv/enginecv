import { describe, expect, it } from "vitest";
import {
    getBuiltinTemplateById,
    getBuiltinTemplates,
    getTemplatePreviewOptions,
    isBuiltinTemplateId,
    resolveBuiltinTemplateId,
} from "./enginecv-templates";
import { templateDocumentSchema } from "./template-schema";

describe("builtin templates", () => {
    it("all parse against the template schema", () => {
        const templates = getBuiltinTemplates();
        for (const tpl of templates) {
            expect(() => templateDocumentSchema.parse(tpl)).not.toThrow();
        }
    });

    it("ships the eight distinct templates with unique ids", () => {
        const templates = getBuiltinTemplates();
        expect(templates.map((t) => t.meta.name)).toEqual([
            "Modern", "ATS Plain", "Sidebar", "Photo Header", "Lebenslauf", "Timeline", "Executive", "Developer",
        ]);
        expect(new Set(templates.map((t) => t.id)).size).toBe(templates.length);
    });

    it("resolves retired template ids to their replacement", () => {
        const retired: Record<string, string> = {
            "enginecv-classic": "Modern",
            "enginecv-bold-header": "Modern",
            "enginecv-minimalist": "ATS Plain",
            "enginecv-manuscript": "Executive",
            "enginecv-brutalist": "Developer",
        };
        for (const [id, name] of Object.entries(retired)) {
            expect(isBuiltinTemplateId(id), id).toBe(true);
            expect(getBuiltinTemplateById(id)?.meta.name, id).toBe(name);
            expect(getBuiltinTemplates().some((t) => t.id === id), id).toBe(false);
        }
        expect(resolveBuiltinTemplateId("enginecv-modern")).toBe("enginecv-modern");
    });

    it("previews the photo templates with a photo and Lebenslauf in German", () => {
        expect(getTemplatePreviewOptions("enginecv-photo-header")).toEqual({ photo: true });
        expect(getTemplatePreviewOptions("enginecv-lebenslauf")).toEqual({ photo: true, language: "de" });
        expect(getTemplatePreviewOptions("enginecv-modern")).toEqual({});
    });

    it("keeps ATS Plain free of section icons", () => {
        const ats = getBuiltinTemplateById("enginecv-compact")!;
        for (const key of ["experience", "education", "projects", "skills", "languages"]) {
            expect(ats.settings.sectionDisplay[key]?.showIcon, key).toBe(false);
        }
        expect(ats.settings.entryLayout.layout).toBe("singleCol");
    });

    it("gives the entry content the wide column in two-column layouts", () => {
        for (const tpl of getBuiltinTemplates()) {
            const { entryLayout } = tpl.settings;
            // leftWidth is the date column in contentRight and the content column in contentLeft.
            const contentShare = entryLayout.layout === "contentLeft"
                ? entryLayout.leftWidth
                : entryLayout.layout === "contentRight" ? 100 - entryLayout.leftWidth : null;
            if (contentShare === null) continue;
            expect(contentShare, tpl.id).toBeGreaterThanOrEqual(60);
        }
    });

    it("recognises every template id via isBuiltinTemplateId", () => {
        for (const tpl of getBuiltinTemplates()) {
            expect(isBuiltinTemplateId(tpl.id)).toBe(true);
        }
        expect(isBuiltinTemplateId("not-a-real-template")).toBe(false);
    });

    it("keeps border usage uncluttered across builtin templates", () => {
        const hasVisibleBorder = (border?: {
            width: number;
            top: boolean;
            bottom: boolean;
            left: boolean;
            right: boolean;
        }) => Boolean(border && border.width > 0 && (border.top || border.bottom || border.left || border.right));

        for (const tpl of getBuiltinTemplates()) {
            const settings = tpl.settings;
            // Photo frames are excluded: the schema default is a subtle 1px
            // frame and it outlines only the photo, not the page layout.
            const lineSystems = [
                settings.headings.border,
                settings.personalDetails.border,
                settings.contentStyle.border,
            ].filter(hasVisibleBorder).length;

            // At most two ruled layout surfaces per template; only Timeline
            // keeps a section-body border (its dashed left rule IS the timeline),
            // so it alone may carry three.
            const allowed = tpl.id === "enginecv-timeline" ? 3 : 2;
            expect(lineSystems, `${tpl.id} has too many ruled surfaces`).toBeLessThanOrEqual(allowed);
            if (tpl.id !== "enginecv-timeline") {
                expect(
                    hasVisibleBorder(settings.contentStyle.border),
                    `${tpl.id} should not draw a border on every section body`,
                ).toBe(false);
            }
        }
    });
});
