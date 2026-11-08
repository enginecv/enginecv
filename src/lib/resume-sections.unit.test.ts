import { describe, expect, it } from "vitest";
import { createEmptyResume, resumeSchema, type Resume } from "@/lib/schema";
import { getOrderedVisibleSections, isCustomSectionEmpty } from "./resume-sections";

function makeResume(overrides: Record<string, unknown>): Resume {
    return resumeSchema.parse({ ...createEmptyResume(), ...overrides });
}

const experience = [{ id: "e1", position: "Engineer", company: "Acme" }];
const education = [{ id: "d1", institution: "Uni", studyType: "BSc" }];
const projects = [{ id: "p1", name: "Proj" }];

describe("getOrderedVisibleSections", () => {
    it("follows the configured section order", () => {
        const resume = makeResume({
            experience,
            education,
            projects,
            settings: {
                contentSections: ["experience", "education", "projects"],
                layout: { sectionOrder: ["projects", "experience", "education"] },
            },
        });

        expect(getOrderedVisibleSections(resume).map((section) => section.key)).toEqual([
            "projects",
            "experience",
            "education",
        ]);
    });

    it("appends populated sections the order does not mention", () => {
        const resume = makeResume({
            experience,
            education,
            settings: {
                contentSections: ["experience", "education"],
                layout: { sectionOrder: ["education"] },
            },
        });

        expect(getOrderedVisibleSections(resume).map((section) => section.key)).toEqual([
            "education",
            "experience",
        ]);
    });

    it("renders every populated section for legacy documents without contentSections", () => {
        const resume = makeResume({
            experience,
            projects,
            settings: { contentSections: [], layout: { sectionOrder: [] } },
        });

        expect(getOrderedVisibleSections(resume).map((section) => section.type)).toEqual([
            "experience",
            "projects",
        ]);
    });

    it("drops hidden sections and hidden entries", () => {
        const resume = makeResume({
            experience: [
                { id: "e1", position: "Visible" },
                { id: "e2", position: "Hidden", hidden: true },
            ],
            projects,
            settings: {
                contentSections: ["experience", "projects"],
                hiddenSections: ["projects"],
                layout: { sectionOrder: ["experience", "projects"] },
            },
        });

        const sections = getOrderedVisibleSections(resume);
        expect(sections.map((section) => section.type)).toEqual(["experience"]);
        const [section] = sections;
        expect(section.type === "experience" && section.entries.map((entry) => entry.position)).toEqual([
            "Visible",
        ]);
    });

    it("resolves a suffixed configured key while ordering by its base", () => {
        const resume = makeResume({
            experience,
            settings: {
                contentSections: ["experience:2"],
                layout: { sectionOrder: ["experience"] },
            },
        });

        expect(getOrderedVisibleSections(resume).map((section) => section.key)).toEqual(["experience:2"]);
    });

    it("keeps skills as groups and drops groups with no visible skills", () => {
        const resume = makeResume({
            skillGroups: [
                { id: "ungrouped", name: "", skills: [{ id: "s1", name: "Go" }] },
                { id: "g2", name: "Empty", skills: [] },
            ],
            settings: {
                contentSections: ["skills"],
                layout: { sectionOrder: ["skills"] },
            },
        });

        const [section] = getOrderedVisibleSections(resume);
        expect(section.type === "skills" && section.groups.map((group) => group.id)).toEqual(["ungrouped"]);
    });

    it("includes only configured, non-empty custom sections", () => {
        const resume = makeResume({
            customSections: [
                { id: "c1", title: "Volunteering", layout: "text", text: "Helped out" },
                { id: "c2", title: "Empty", layout: "text", text: "   " },
                { id: "c3", title: "Unconfigured", layout: "text", text: "Hi" },
            ],
            settings: {
                contentSections: ["custom:c1", "custom:c2"],
                layout: { sectionOrder: ["custom:c1", "custom:c2"] },
            },
        });

        expect(getOrderedVisibleSections(resume).map((section) => section.key)).toEqual(["custom:c1"]);
    });
});

describe("isCustomSectionEmpty", () => {
    const base = { id: "c1", hidden: false, title: "T", icon: "auto" } as const;

    it("treats whitespace-only text and tags as empty", () => {
        expect(isCustomSectionEmpty({ ...base, layout: "text", text: "  ", tags: [], entries: [] })).toBe(true);
        expect(isCustomSectionEmpty({ ...base, layout: "tags", text: "", tags: ["  "], entries: [] })).toBe(true);
    });

    it("treats a section whose entries are all hidden as empty", () => {
        expect(isCustomSectionEmpty({
            ...base,
            layout: "entries",
            text: "",
            tags: [],
            entries: [{
                id: "x",
                hidden: true,
                title: "Hidden",
                subtitle: "",
                location: "",
                description: "",
                skills: [],
                url: "",
                urlIcon: "auto",
            }],
        })).toBe(true);
    });
});
