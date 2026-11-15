import { describe, expect, it } from "vitest";
import { createEmptyResume, resumeSchema, type Resume } from "@/lib/schema";
import { getVisibleContentKeys, getVisibleSourceIndices, isSectionHidden, visibleEntries } from "./visibility";

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

describe("getVisibleSourceIndices", () => {
    const entry = (id: string, hidden = false) => ({ id, hidden });

    it("maps each visible entry back to its position in the full list", () => {
        const resume = makeResume({
            settings: { contentSections: ["projects"] },
            projects: [entry("a", true), entry("b"), entry("c", true), entry("d")],
        });

        expect(getVisibleSourceIndices(resume, "projects")).toEqual([1, 3]);
    });

    it("is the identity when nothing is hidden, and empty for no entries", () => {
        const resume = makeResume({
            settings: { contentSections: ["education"] },
            education: [entry("a"), entry("b"), entry("c")],
        });

        expect(getVisibleSourceIndices(resume, "education")).toEqual([0, 1, 2]);
        expect(getVisibleSourceIndices(resume, "projects")).toEqual([]);
    });

    it("covers every entry section, repeated section keys and custom sections", () => {
        const resume = makeResume({
            settings: { contentSections: ["experience", "custom:c1"] },
            experience: [entry("x", true), entry("y")],
            customSections: [{ id: "c1", title: "Extra", entries: [entry("p"), entry("q", true), entry("r")] }],
        });

        expect(getVisibleSourceIndices(resume, "experience")).toEqual([1]);
        expect(getVisibleSourceIndices(resume, "experience:2")).toEqual([1]);
        expect(getVisibleSourceIndices(resume, "custom:c1")).toEqual([0, 2]);
        expect(getVisibleSourceIndices(resume, "custom:missing")).toEqual([]);
    });

    it("maps the skill groups the preview shows back to their position in the full group list", () => {
        const skill = (id: string, hidden = false) => ({ id, name: id, hidden, level: "", icon: "auto", display: "both", description: "", keywords: [] });
        const resume = makeResume({
            settings: { contentSections: ["skills"] },
            skillGroups: [
                { id: "g1", name: "Hidden group", hidden: true, skills: [skill("a")] },
                { id: "g2", name: "Shown", hidden: false, skills: [skill("b")] },
                { id: "g3", name: "All skills hidden", hidden: false, skills: [skill("c", true)] },
                { id: "g4", name: "Also shown", hidden: false, skills: [skill("d"), skill("e", true)] },
            ],
        });

        const shown = getVisibleSourceIndices(resume, "skills").map((index) => resume.skillGroups[index].id);
        expect(shown).toEqual(["g2", "g4"]);
    });

    it("returns an empty list for a section type without entries", () => {
        expect(getVisibleSourceIndices(makeResume({}), "unknown")).toEqual([]);
    });
});
