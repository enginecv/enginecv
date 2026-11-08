import { describe, expect, it } from "vitest";
import { createEmptyResume, resumeSchema, type Resume } from "@/lib/schema";
import { toDocumentModel } from "./document-model";
import { toMarkdown } from "./export-markdown";

function makeResume(overrides: Record<string, unknown>): Resume {
    return resumeSchema.parse({ ...createEmptyResume(), ...overrides });
}

function markdownFor(overrides: Record<string, unknown>, frontMatter = false): string {
    return toMarkdown(toDocumentModel(makeResume(overrides)), { frontMatter });
}

describe("toMarkdown", () => {
    it("emits the header, contact line and summary", () => {
        const markdown = markdownFor({
            basics: {
                name: "Jane Doe",
                headline: "Engineer",
                email: "jane@example.com",
                phone: "+387 60 000 000",
                location: "Sarajevo",
                summary: "Builds things.",
                github: "github.com/jane",
            },
        });

        expect(markdown).toContain("# Jane Doe");
        expect(markdown).toContain("[jane@example.com](mailto:jane@example.com)");
        expect(markdown).toContain("[GitHub](https://github.com/jane)");
        expect(markdown).toContain("## Summary\n\nBuilds things.");
    });

    it("emits only visible sections, in the configured order", () => {
        const markdown = markdownFor({
            experience: [{ id: "e1", position: "Engineer", company: "Acme" }],
            projects: [{ id: "p1", name: "Proj" }],
            education: [{ id: "d1", studyType: "BSc", institution: "Uni" }],
            settings: {
                contentSections: ["experience", "projects", "education"],
                hiddenSections: ["education"],
                layout: { sectionOrder: ["projects", "experience"] },
            },
        });

        const headings = markdown.split("\n").filter((line) => line.startsWith("## "));
        expect(headings).toEqual(["## Projects", "## Experience"]);
    });

    it("keeps entry Markdown bodies verbatim", () => {
        const body = "**Led** the team:\n\n- shipped [it](https://x.com)\n- twice";
        const markdown = markdownFor({
            experience: [{ id: "e1", position: "Engineer", company: "Acme", description: body }],
            settings: { contentSections: ["experience"], layout: { sectionOrder: ["experience"] } },
        });

        expect(markdown).toContain(body);
    });

    it("renders the entry link on the subtitle and the meta line from dates and location", () => {
        const markdown = markdownFor({
            experience: [{
                id: "e1",
                position: "Engineer",
                company: "Acme",
                url: "acme.com",
                start: "2020-03",
                end: "2022-06",
                location: "Remote",
            }],
            settings: {
                dateFormat: "MMM DD, YYYY",
                contentSections: ["experience"],
                layout: { sectionOrder: ["experience"] },
            },
        });

        expect(markdown).toContain("### Engineer");
        expect(markdown).toContain("**[Acme](https://acme.com)**");
        expect(markdown).toContain("*Mar 2020 – Jun 2022 · Remote*");
    });

    it("escapes Markdown syntax in generated plain text", () => {
        const markdown = markdownFor({
            experience: [{ id: "e1", position: "C++ [lead]", company: "A*B", location: "- Remote" }],
            settings: { contentSections: ["experience"], layout: { sectionOrder: ["experience"] } },
        });

        expect(markdown).toContain("### C++ \\[lead\\]");
        expect(markdown).toContain("**A\\*B**");
        // Inside an emphasized meta line a leading dash cannot start a list.
        expect(markdown).toContain("*- Remote*");
    });

    it("leaves phone numbers and domains unescaped", () => {
        const markdown = markdownFor({
            basics: { name: "Jane", phone: "+387 60 000 000", email: "jane@example.com" },
        });

        expect(markdown).toContain("[jane@example.com](mailto:jane@example.com)");
        expect(markdown).toContain("+387 60 000 000");
    });

    it("neutralizes a block marker that would start a generated line", () => {
        const markdown = markdownFor({
            basics: { name: "Jane", headline: "- Engineer", phone: "+387 60 000 000" },
        });

        expect(markdown).toContain("\\- Engineer");
        // The phone opens the contact line here, so its plus sign is escaped.
        expect(markdown).toContain("\\+387 60 000 000");
    });

    it("renders skill groups and custom tag sections", () => {
        const markdown = markdownFor({
            skillGroups: [{ id: "ungrouped", name: "", skills: [{ id: "s1", name: "Go" }] },
                { id: "g2", name: "Cloud", skills: [{ id: "s2", name: "AWS" }] }],
            customSections: [{ id: "c1", title: "Stack", layout: "tags", tags: ["Rust"] }],
            settings: {
                contentSections: ["skills", "custom:c1"],
                layout: { sectionOrder: ["skills", "custom:c1"] },
            },
        });

        expect(markdown).toContain("`Go`");
        expect(markdown).toContain("**Cloud:** `AWS`");
        expect(markdown).toContain("## Stack\n\n`Rust`");
    });

    it("writes YAML front matter as one contiguous block when enabled", () => {
        const markdown = markdownFor({
            basics: { name: 'Jane "JD" Doe', email: "jane@example.com", website: "jane.dev" },
        }, true);

        expect(markdown.startsWith("---\n")).toBe(true);
        expect(markdown).toContain('name: "Jane \\"JD\\" Doe"');
        expect(markdown).toContain('  - label: "jane.dev"');
        expect(markdown).toContain('    url: "https://jane.dev"');
        expect(markdown.split("---").length).toBe(3);
    });

    it("omits front matter unless requested", () => {
        expect(markdownFor({ basics: { name: "Jane" } }).startsWith("# Jane")).toBe(true);
    });

    it("produces an empty file for an empty resume rather than stray headings", () => {
        expect(markdownFor({})).toBe("");
    });
});
