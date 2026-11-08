import { describe, expect, it } from "vitest";
import { countWords } from "@/lib/content-depth/word-count";
import { getGalleryTemplates } from "../gallery";
import { getTemplateProse, templateProseParagraphs } from "./index";

/** Shown text under each English template page, on top of the translated summary and facts. */
const TEMPLATE_PROSE_MIN = 300;
const TEMPLATE_PROSE_MAX = 500;

describe("template prose", () => {
    const slugs = getGalleryTemplates().map(({ slug }) => slug);

    it("has a prose module for every gallery template", () => {
        expect(slugs.filter((slug) => !getTemplateProse(slug))).toEqual([]);
    });

    it(`keeps each template's prose between ${TEMPLATE_PROSE_MIN} and ${TEMPLATE_PROSE_MAX} words`, () => {
        const outside = slugs
            .map((slug) => ({ slug, words: countWords(templateProseParagraphs(getTemplateProse(slug)!).join("\n\n")) }))
            .filter(({ words }) => words < TEMPLATE_PROSE_MIN || words > TEMPLATE_PROSE_MAX);
        expect(outside).toEqual([]);
    });

    it("gives every template at least two overview paragraphs, two build paragraphs, three tips and two alternatives", () => {
        for (const slug of slugs) {
            const prose = getTemplateProse(slug)!;
            expect(prose.slug).toBe(slug);
            expect(prose.overview.length).toBeGreaterThanOrEqual(2);
            expect(prose.build.length).toBeGreaterThanOrEqual(2);
            expect(prose.tips.length).toBeGreaterThanOrEqual(3);
            expect(prose.alternatives.length).toBeGreaterThanOrEqual(2);
        }
    });

    it("only recommends templates that exist", () => {
        const names = ["Modern", "ATS Plain", "Sidebar", "Photo Header", "Lebenslauf", "Timeline", "Executive", "Developer"];
        for (const slug of slugs) {
            for (const item of getTemplateProse(slug)!.alternatives) {
                expect(names.some((name) => item.includes(name)), item).toBe(true);
            }
        }
    });
});
