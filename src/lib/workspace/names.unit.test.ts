import { describe, expect, it } from "vitest";
import { documentFileName, isNameClash, keysOf, nameKey, nameProblem, parseDocumentFileName, safeStem, uniqueFileName } from "./names";

describe("workspace file names", () => {
    it("makes titles safe for every system", () => {
        expect(safeStem("Master CV")).toBe("Master CV");
        expect(safeStem('Résumé: "Åke" / <draft>?')).toBe("Résumé Åke draft");
        expect(safeStem("日本語 emoji 😀")).toBe("日本語 emoji 😀");
        expect(safeStem("  a   b  ")).toBe("a b");
        expect(safeStem("...")).toBe("untitled");
        expect(safeStem("")).toBe("untitled");
        expect(safeStem("trailing dot.")).toBe("trailing dot");
    });

    it("never produces a reserved Windows name", () => {
        for (const reserved of ["con", "PRN", "aux", "nul", "com1", "LPT9", "con.txt"]) {
            expect(nameProblem(`${safeStem(reserved)}.cv.json`)).toBeNull();
            expect(safeStem(reserved).toLowerCase()).not.toMatch(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/);
        }
    });

    it("caps long titles", () => {
        expect(safeStem("x".repeat(300)).length).toBe(120);
    });

    it("flags names that must not be written", () => {
        expect(nameProblem("con.cv.json")).toBe("reserved-name");
        expect(nameProblem("name .cv.json ")).toBe("reserved-name");
        expect(nameProblem("fine.cv.json")).toBeNull();
        expect(nameProblem("fine.letter.json")).toBeNull();
    });

    it("compares names without regard to case or Unicode form", () => {
        expect(nameKey("UPPER.cv.json")).toBe(nameKey("upper.cv.json"));
        expect(nameKey("Å.cv.json")).toBe(nameKey("Å.cv.json")); // precomposed vs combining
        expect(isNameClash("Master.cv.json", keysOf(["master.CV.json"]))).toBe(true);
        expect(isNameClash("other.cv.json", keysOf(["master.cv.json"]))).toBe(false);
    });

    it("suffixes a clash with -2, -3, ...", () => {
        const taken = keysOf(["Master.cv.json", "master-2.cv.json"]);
        expect(uniqueFileName("master", "cv", taken)).toBe("master-3.cv.json");
        expect(uniqueFileName("master", "letter", taken)).toBe("master.letter.json");
        expect(uniqueFileName("fresh", "cv", taken)).toBe("fresh.cv.json");
    });

    it("recognises document file names and their kind", () => {
        expect(parseDocumentFileName("a.cv.json")).toEqual({ kind: "cv", stem: "a" });
        expect(parseDocumentFileName("A.LETTER.JSON")).toEqual({ kind: "letter", stem: "A" });
        expect(parseDocumentFileName("notes.json")).toBeNull();
        expect(parseDocumentFileName(".cv.json")).toBeNull();
        expect(documentFileName("x", "letter")).toBe("x.letter.json");
    });
});
