import { describe, expect, it } from "vitest";
import { containment, isThinEntry, matchKey, normaliseText, sameItem, similar, yearOf } from "./keys";
import type { StagedEntry } from "./types";

const entry = (fields: Record<string, unknown>): StagedEntry => ({ id: "x", ...fields });

describe("normaliseText", () => {
    it("ignores case, punctuation, accents and legal suffixes", () => {
        expect(normaliseText("Acme, Inc.")).toBe("acme");
        expect(normaliseText("  ACME   GmbH ")).toBe("acme");
        expect(normaliseText("Ćevap d.o.o.")).toBe("cevap");
        expect(normaliseText("R&D Labs")).toBe("r and d labs");
    });

    it("keeps characters that name skills", () => {
        expect(normaliseText("C++")).toBe("c++");
        expect(normaliseText("C#")).toBe("c#");
    });

    it("returns an empty text for anything that is not a string", () => {
        expect(normaliseText(undefined)).toBe("");
        expect(normaliseText(42)).toBe("");
    });
});

describe("yearOf", () => {
    it("reads a year from any date precision", () => {
        expect(yearOf("2020")).toBe("2020");
        expect(yearOf("2020-03")).toBe("2020");
        expect(yearOf("03/2020")).toBe("2020");
        expect(yearOf("Present")).toBe("");
        expect(yearOf(undefined)).toBe("");
    });
});

describe("similar", () => {
    it("matches equal and containing names", () => {
        expect(similar("Acme", "acme inc")).toBe(true);
        expect(similar("Acme", "Acme Systems")).toBe(true);
        expect(similar("Acme", "Globex")).toBe(false);
    });

    it("never matches an empty text", () => {
        expect(similar("", "Acme")).toBe(false);
    });

    it("measures how much of the shorter text the longer one holds", () => {
        expect(containment("a b", "a b c d")).toBe(1);
        expect(containment("a x", "a b c d")).toBe(0.5);
        expect(containment("", "a")).toBe(0);
    });
});

describe("matchKey", () => {
    it("is the same for the same job written two ways", () => {
        const a = entry({ company: "Acme Inc.", position: "Engineer", start: "2020-03" });
        const b = entry({ company: "ACME", position: "engineer", start: "2020" });
        expect(matchKey("experience", a)).toBe(matchKey("experience", b));
    });

    it("differs by position and by year", () => {
        const base = entry({ company: "Acme", position: "Engineer", start: "2020" });
        expect(matchKey("experience", entry({ company: "Acme", position: "Manager", start: "2020" }))).not.toBe(matchKey("experience", base));
        expect(matchKey("experience", entry({ company: "Acme", position: "Engineer", start: "2018" }))).not.toBe(matchKey("experience", base));
    });
});

describe("sameItem", () => {
    it("treats a typo-free near name and a missing date as the same job", () => {
        const a = entry({ company: "Acme", position: "Engineer", start: "2020-03" });
        const b = entry({ company: "Acme Systems", position: "Engineer", start: "" });
        expect(sameItem("experience", a, b)).toBe(true);
    });

    it("keeps a promotion at the same company apart", () => {
        const a = entry({ company: "Acme", position: "Engineer", start: "2019" });
        const b = entry({ company: "Acme", position: "Senior Engineer Lead Platform", start: "2022" });
        expect(sameItem("experience", a, b)).toBe(false);
    });

    it("keeps the same school at different years apart", () => {
        const a = entry({ institution: "MIT", area: "CS", start: "2010" });
        const b = entry({ institution: "MIT", area: "CS", start: "2016" });
        expect(sameItem("education", a, b)).toBe(false);
    });

    it("matches skills only by exact name", () => {
        expect(sameItem("skills", entry({ name: "React" }), entry({ name: "react" }))).toBe(true);
        expect(sameItem("skills", entry({ name: "React" }), entry({ name: "React Native" }))).toBe(false);
    });

    it("never matches an entry with no name", () => {
        expect(sameItem("projects", entry({ name: "" }), entry({ name: "" }))).toBe(false);
    });

    it("matches each remaining section by its own fields", () => {
        expect(sameItem("projects", entry({ name: "Engine CV" }), entry({ name: "engine cv" }))).toBe(true);
        expect(sameItem("certificates", entry({ name: "AWS SAA", issuer: "Amazon" }), entry({ name: "AWS SAA", issuer: "Amazon Web Services" }))).toBe(true);
        expect(sameItem("languages", entry({ language: "German" }), entry({ language: "german" }))).toBe(true);
        expect(sameItem("references", entry({ name: "Jane Doe", organisation: "Acme" }), entry({ name: "Jane Doe", organisation: "Globex" }))).toBe(false);
    });
});

describe("isThinEntry", () => {
    it("flags an entry that is only a name", () => {
        expect(isThinEntry("projects", entry({ name: "Thing", description: "", highlights: [] }))).toBe(true);
        expect(isThinEntry("projects", entry({ name: "Thing", description: "Real text" }))).toBe(false);
    });

    it("never flags skills, languages or interests", () => {
        expect(isThinEntry("skills", entry({ name: "Go" }))).toBe(false);
    });
});
