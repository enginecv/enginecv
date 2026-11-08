import { describe, expect, it } from "vitest";
import { createEmptyResume, resumeSchema, type Resume } from "@/lib/schema";
import { getVisibleContentKeys, isSectionHidden, visibleEntries } from "./visibility";

function makeResume(overrides: Record<string, unknown>): Resume {
    return resumeSchema.parse({ ...createEmptyResume(), ...overrides });
}

describe("visibility selectors", () => {
    it("reports section hidden state from settings.hiddenSections", () => {
        const resume = makeResume({
            settings: { contentSections: ["skills"], hiddenSections: ["skills"] },
        });

        expect(isSectionHidden(resume, "skills")).toBe(true);
        expect(isSectionHidden(resume, "projects")).toBe(false);
    });

    it("filters hidden entries preserving order", () => {
        const entries = [
            { id: "a", hidden: false },
            { id: "b", hidden: true },
            { id: "c" },
        ];

        expect(visibleEntries(entries).map((e) => (e as { id: string }).id)).toEqual(["a", "c"]);
    });

    it("drops explicitly hidden section keys", () => {
        const resume = makeResume({
            skillGroups: [{ id: "ungrouped", name: "", hidden: false, skills: [{ id: "s1", name: "Go" }] }],
            projects: [{ id: "p1", name: "Proj" }],
            settings: {
                contentSections: ["skills", "projects"],
                hiddenSections: ["projects"],
            },
        });

        expect(getVisibleContentKeys(resume)).toEqual(["skills"]);
    });

    it("drops sections whose entries are all hidden", () => {
        const resume = makeResume({
            skillGroups: [{
                id: "ungrouped",
                name: "",
                hidden: false,
                skills: [
                    { id: "s1", name: "Go", hidden: true },
                    { id: "s2", name: "Rust", hidden: true },
                ],
            }],
            experience: [{ id: "e1", company: "Acme" }],
            settings: { contentSections: ["skills", "experience"], hiddenSections: [] },
        });

        expect(getVisibleContentKeys(resume)).toEqual(["experience"]);
    });

    it("keeps sections with zero entries (existing empty-section behavior unchanged)", () => {
        const resume = makeResume({
            settings: { contentSections: ["skills"], hiddenSections: [] },
        });

        expect(getVisibleContentKeys(resume)).toEqual(["skills"]);
    });

    it("keeps unknown section types untouched", () => {
        const resume = makeResume({
            settings: { contentSections: ["custom-section"], hiddenSections: [] },
        });

        expect(getVisibleContentKeys(resume)).toEqual(["custom-section"]);
    });

    it("hides multi-instance section keys independently", () => {
        const resume = makeResume({
            projects: [{ id: "p1", name: "Proj" }],
            settings: {
                contentSections: ["projects", "projects:2"],
                hiddenSections: ["projects:2"],
            },
        });

        expect(getVisibleContentKeys(resume)).toEqual(["projects"]);
        expect(isSectionHidden(resume, "projects:2")).toBe(true);
    });
});
