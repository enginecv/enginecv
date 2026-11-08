import { describe, expect, it } from "vitest";
import { createEmptyResume, resumeSchema, type Resume } from "@/lib/schema";
import { toDocumentLink, toDocumentModel } from "./document-model";

function makeResume(overrides: Record<string, unknown>): Resume {
    return resumeSchema.parse({ ...createEmptyResume(), ...overrides });
}

describe("toDocumentLink", () => {
    it("keeps absolute and scheme-prefixed targets", () => {
        expect(toDocumentLink("https://acme.com", "Acme")).toEqual({ url: "https://acme.com", label: "Acme" });
        expect(toDocumentLink("mailto:a@b.com", "")).toEqual({ url: "mailto:a@b.com", label: "mailto:a@b.com" });
    });

    it("upgrades bare hosts to https", () => {
        expect(toDocumentLink("acme.com/jobs", "Acme")?.url).toBe("https://acme.com/jobs");
    });

    it("drops empty and unresolvable targets", () => {
        expect(toDocumentLink("", "Acme")).toBeNull();
        expect(toDocumentLink("   ", "Acme")).toBeNull();
        expect(toDocumentLink("not a url", "Acme")).toBeNull();
    });
});

describe("toDocumentModel", () => {
    it("formats dates with the resume's format and language", () => {
        const resume = makeResume({
            experience: [{ id: "e1", position: "Engineer", company: "Acme", start: "2020-03", end: "2022-06" }],
            settings: {
                language: "de",
                dateFormat: "DD.MM.YYYY",
                contentSections: ["experience"],
                layout: { sectionOrder: ["experience"] },
            },
        });

        const [section] = toDocumentModel(resume).sections;
        expect(section.entries[0].dateRange).toBe("03.2020 – 06.2022");
    });

    it("takes every built-in heading from the CV language", () => {
        const resume = makeResume({
            experience: [{ id: "e1", position: "Engineer" }],
            organisations: [{ id: "o1", name: "Club" }],
            settings: {
                language: "de",
                contentSections: ["experience", "organisations"],
                layout: { sectionOrder: ["experience", "organisations"] },
            },
        });

        const model = toDocumentModel(resume);

        expect(model.sections.map((section) => section.heading)).toEqual(["Erfahrung", "Organisationen"]);
    });

    it("says how a language was assessed, in the CV language", () => {
        const resume = makeResume({
            languages: [
                { id: "l1", language: "German", fluency: "C1", assessmentType: "issuer",
                  issuer: "Goethe-Institut", assessmentId: "G-42" },
                { id: "l2", language: "French", fluency: "B2", assessmentType: "self" },
            ],
            settings: {
                language: "de",
                contentSections: ["languages"],
                layout: { sectionOrder: ["languages"] },
            },
        });

        const [section] = toDocumentModel(resume).sections;
        expect(section.entries[0].details.map((detail) => detail.value)).toEqual([
            "Von Organisation ausgestellt: Goethe-Institut",
            "Nachweis-ID: G-42",
        ]);
        expect(section.entries[1].details.map((detail) => detail.value)).toEqual(["Selbsteinschätzung"]);
    });

    it("lists per-skill CEFR levels in the CV language before the assessment", () => {
        const resume = makeResume({
            languages: [
                { id: "l1", language: "Englisch", fluency: "C1", assessmentType: "self", cefrDetailed: true,
                  cefr: { listening: "C2", reading: "C1", spokenInteraction: "", spokenProduction: "B2", writing: "C1" } },
                { id: "l2", language: "Spanisch", fluency: "A2", assessmentType: "none", cefrDetailed: false,
                  cefr: { listening: "B1", reading: "", spokenInteraction: "", spokenProduction: "", writing: "" } },
            ],
            settings: { language: "de", contentSections: ["languages"], layout: { sectionOrder: ["languages"] } },
        });

        const [section] = toDocumentModel(resume).sections;
        expect(section.entries[0].details.map((detail) => detail.value)).toEqual([
            "Hören C2 · Lesen C1 · Zusammenhängendes Sprechen B2 · Schreiben C1",
            "Selbsteinschätzung",
        ]);
        // Grid data kept from an earlier detailed session stays out of single-level exports.
        expect(section.entries[1].details).toEqual([]);
    });

    it("says nothing about assessment for a native language", () => {
        const resume = makeResume({
            languages: [{ id: "l1", language: "Bosnian", fluency: "Native", assessmentType: "self" }],
            settings: { contentSections: ["languages"], layout: { sectionOrder: ["languages"] } },
        });

        expect(toDocumentModel(resume).sections[0].entries[0].details).toEqual([]);
    });

    it("prefers a customized section title over the built-in label", () => {
        const resume = makeResume({
            experience: [{ id: "e1", position: "Engineer" }],
            settings: {
                contentSections: ["experience"],
                sectionDisplay: { experience: { title: "Work History" } },
                layout: { sectionOrder: ["experience"] },
            },
        });

        expect(toDocumentModel(resume).sections[0].heading).toBe("Work History");
    });

    it("passes rich-text bodies through verbatim and falls back to highlights", () => {
        const resume = makeResume({
            experience: [
                { id: "e1", position: "A", description: "**Bold** and [link](https://x.com)" },
                { id: "e2", position: "B", highlights: ["Shipped it", " "] },
            ],
            settings: { contentSections: ["experience"], layout: { sectionOrder: ["experience"] } },
        });

        const [section] = toDocumentModel(resume).sections;
        expect(section.entries[0].body).toBe("**Bold** and [link](https://x.com)");
        expect(section.entries[0].bullets).toEqual([]);
        expect(section.entries[1].bullets).toEqual(["Shipped it"]);
    });

    it("omits entry links with empty URLs", () => {
        const resume = makeResume({
            experience: [
                { id: "e1", position: "A", company: "Acme", url: "" },
                { id: "e2", position: "B", company: "Globex", url: "globex.com" },
            ],
            settings: { contentSections: ["experience"], layout: { sectionOrder: ["experience"] } },
        });

        const [section] = toDocumentModel(resume).sections;
        expect(section.entries[0].link).toBeNull();
        expect(section.entries[1].link).toEqual({ url: "https://globex.com", label: "Globex" });
    });

    it("orders personal details by the stored details order", () => {
        const resume = makeResume({
            basics: {
                name: "Jane",
                nationality: "Bosnian",
                dateOfBirth: "1990-01-01",
                detailsOrder: ["field:nationality", "field:dateOfBirth"],
            },
        });

        expect(toDocumentModel(resume).basics.details.map((detail) => detail.value)).toEqual([
            "Bosnian",
            "1990-01-01",
        ]);
    });

    it("carries custom section layouts into the model", () => {
        const resume = makeResume({
            customSections: [
                { id: "c1", title: "About", layout: "text", text: "Some *markdown*" },
                { id: "c2", title: "Stack", layout: "tags", tags: ["Go", " ", "Rust"] },
            ],
            settings: {
                contentSections: ["custom:c1", "custom:c2"],
                layout: { sectionOrder: ["custom:c1", "custom:c2"] },
            },
        });

        const [text, tags] = toDocumentModel(resume).sections;
        expect(text.text).toBe("Some *markdown*");
        expect(tags.tags).toEqual(["Go", "Rust"]);
    });
});
