import { describe, expect, it } from "vitest";
import { toDocumentModel } from "../document-model";
import { toMarkdown } from "../export-markdown";
import { getOrderedVisibleSections, type OrderedResumeSectionType } from "../resume-sections";
import { resumeSchema } from "../schema";
import {
    createQaEdgeCaseResume,
    createQaFullResume,
    createQaMinimalResume,
    QA_CONTENT_SECTIONS,
    QA_FULL_SECTION_KEYS,
    QA_HIDDEN_MARKER,
    QA_RESUME_FIXTURES,
} from "./sample-resumes";

/**
 * Every section type the renderer knows about. The full fixture must produce a
 * block for each, so adding a section to `OrderedResumeSection` without adding
 * entries to the fixture fails here rather than silently going untested.
 */
const ALL_SECTION_TYPES: OrderedResumeSectionType[] = [
    "experience", "education", "courses", "certificates", "awards", "publications",
    "references", "declaration", "projects", "organisations", "interests",
    "languages", "skills", "custom",
];

describe("QA fixtures", () => {
    it("are deterministic across calls", () => {
        expect(createQaFullResume()).toEqual(createQaFullResume());
        expect(createQaMinimalResume()).toEqual(createQaMinimalResume());
        expect(createQaEdgeCaseResume()).toEqual(createQaEdgeCaseResume());
    });

    it("survive a schema round trip unchanged", () => {
        for (const fixture of QA_RESUME_FIXTURES) {
            const resume = fixture.create();
            expect(resumeSchema.parse(JSON.parse(JSON.stringify(resume)))).toEqual(resume);
        }
    });

    it("serialize to Markdown", () => {
        for (const fixture of QA_RESUME_FIXTURES) {
            expect(toMarkdown(toDocumentModel(fixture.create())).length).toBeGreaterThan(0);
        }
    });
});

describe("QA full fixture", () => {
    const resume = createQaFullResume();
    const sections = getOrderedVisibleSections(resume);

    it("renders every section type the model supports", () => {
        const rendered = new Set(sections.map((section) => section.type));
        expect([...rendered].sort()).toEqual([...ALL_SECTION_TYPES].sort());
    });

    it("renders every configured section key, in order", () => {
        expect(sections.map((section) => section.key)).toEqual(QA_FULL_SECTION_KEYS);
    });

    it("gives every built-in section at least three visible entries", () => {
        for (const section of sections) {
            if (section.type === "skills" || section.type === "custom") continue;
            expect(section.entries.length, `${section.key} entries`).toBeGreaterThanOrEqual(3);
        }
    });

    it("carries every content section in the canonical list", () => {
        for (const key of QA_CONTENT_SECTIONS) {
            expect(sections.some((section) => section.base === key), `${key} missing`).toBe(true);
        }
    });

    it("renders all three custom section layouts", () => {
        const layouts = sections
            .filter((section) => section.type === "custom")
            .map((section) => section.custom.layout);
        expect(layouts.sort()).toEqual(["entries", "tags", "text"]);
    });

    it("keeps hidden entries out of the rendered document", () => {
        // Asserted against the serialized document rather than the section list:
        // custom sections are handed to the document model unfiltered and only
        // drop their hidden entries there.
        expect(toMarkdown(toDocumentModel(resume))).not.toContain(QA_HIDDEN_MARKER);
    });

    it("actually contains hidden entries to filter", () => {
        // Guards the assertion above against passing because the fixture stopped
        // carrying hidden entries at all.
        const hidden = [
            ...resume.experience, ...resume.education, ...resume.courses, ...resume.certificates,
            ...resume.awards, ...resume.publications, ...resume.references, ...resume.declaration,
            ...resume.projects, ...resume.organisations, ...resume.interests, ...resume.languages,
            ...resume.skillGroups.flatMap((group) => group.skills),
            ...resume.customSections.flatMap((section) => section.entries),
        ].filter((entry) => entry.hidden);
        expect(hidden.length).toBe(14);
    });

    it("populates every field of the first entry in each section", () => {
        const complete: Record<string, unknown> = {
            experience: resume.experience[0],
            education: resume.education[0],
            courses: resume.courses[0],
            certificates: resume.certificates[0],
            awards: resume.awards[0],
            publications: resume.publications[0],
            references: resume.references[0],
            declaration: resume.declaration[0],
            projects: resume.projects[0],
            organisations: resume.organisations[0],
            interests: resume.interests[0],
            languages: resume.languages[1], // [0] is native; the schema strips its assessment
            basics: resume.basics,
        };

        for (const [name, entry] of Object.entries(complete)) {
            for (const [field, value] of Object.entries(entry as Record<string, unknown>)) {
                if (field === "hidden") continue; // false is the populated value here
                const empty = value === "" || (Array.isArray(value) && value.length === 0) || value === null;
                expect(empty, `${name}.${field} is empty in the "complete" entry`).toBe(false);
            }
        }
    });

    it("covers every skill level, including none", () => {
        const levels = new Set(resume.skillGroups.flatMap((group) => group.skills.map((skill) => skill.level)));
        expect(levels).toEqual(new Set(["", "beginner", "amateur", "competent", "proficient", "expert"]));
    });

    it("covers every language assessment type", () => {
        const types = new Set(resume.languages.map((language) => language.assessmentType));
        expect(types).toEqual(new Set(["none", "self", "issuer"]));
    });

    it("strips assessment fields from the native language", () => {
        const native = resume.languages.find((language) => language.fluency === "Native")!;
        expect(native.assessmentType).toBe("none");
        expect(native.issuer).toBe("");
        expect(native.assessmentId).toBe("");
        expect(native.assessmentUrl).toBe("");
    });

    it("uses unique ids throughout", () => {
        const ids = [
            ...resume.experience, ...resume.education, ...resume.courses, ...resume.certificates,
            ...resume.awards, ...resume.publications, ...resume.references, ...resume.declaration,
            ...resume.projects, ...resume.organisations, ...resume.interests, ...resume.languages,
            ...resume.skillGroups.flatMap((group) => group.skills),
            ...resume.customSections.flatMap((section) => section.entries),
        ].map((entry) => entry.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe("QA minimal fixture", () => {
    const resume = createQaMinimalResume();

    it("renders no sections at all", () => {
        expect(getOrderedVisibleSections(resume)).toEqual([]);
    });

    it("still produces a document", () => {
        expect(toMarkdown(toDocumentModel(resume))).toContain("Minimal Person");
    });
});

describe("QA edge-case fixture", () => {
    const resume = createQaEdgeCaseResume();
    const sections = getOrderedVisibleSections(resume);

    it("drops a section whose every entry is hidden", () => {
        expect(sections.some((section) => section.base === "experience")).toBe(false);
    });

    it("drops custom sections that are empty in their own layout mode", () => {
        expect(sections.some((section) => section.type === "custom")).toBe(false);
    });

    it("keeps the sections that do have content", () => {
        expect(sections.map((section) => section.base)).toEqual(["education", "skills"]);
    });

    it("drops empty and hidden skill groups", () => {
        const skills = sections.find((section) => section.type === "skills");
        expect(skills?.type).toBe("skills");
        if (skills?.type !== "skills") return;
        expect(skills.groups.map((group) => group.id)).toEqual(["ungrouped"]);
    });
});
