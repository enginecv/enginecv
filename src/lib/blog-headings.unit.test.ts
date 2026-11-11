import { describe, expect, it } from "vitest";
import { extractBlogTocFromMarkdown } from "./blog-headings";

describe("extractBlogTocFromMarkdown", () => {
    it("slugs plain headings and skips code fences", () => {
        const toc = extractBlogTocFromMarkdown("## First point\n\n```\n## not a heading\n```\n\n### Second point");

        expect(toc).toEqual([
            { title: "First point", url: "#first-point", depth: 2 },
            { title: "Second point", url: "#second-point", depth: 3 },
        ]);
    });

    it("uses the custom id from processed markdown and keeps it out of the title", () => {
        const toc = extractBlogTocFromMarkdown("## Field by field [#field-by-field]\n\n### Job title [#job-title]");

        expect(toc).toEqual([
            { title: "Field by field", url: "#field-by-field", depth: 2 },
            { title: "Job title", url: "#job-title", depth: 3 },
        ]);
    });
});
