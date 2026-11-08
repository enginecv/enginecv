import { describe, expect, it } from "vitest";
import { createEmptyResume } from "./schema";
import { getResumeExportBaseName } from "./resume-export";

describe("resume export naming", () => {
    it("uses title, then name, then a stable fallback", () => {
        const resume = createEmptyResume();

        expect(getResumeExportBaseName(resume)).toBe("export");

        resume.basics.name = "Ada Lovelace";
        expect(getResumeExportBaseName(resume)).toBe("ada-lovelace");

        resume.meta.title = "Platform Engineer CV";
        expect(getResumeExportBaseName(resume)).toBe("platform-engineer-cv");
    });
});

describe("resume export filename sanitization", () => {
    it("strips characters file systems reject and caps the length", () => {
        const resume = createEmptyResume();
        resume.meta.title = '  CV: Ada/Lovelace <v2>? "final" | draft.  ';
        expect(getResumeExportBaseName(resume)).toBe("cv-adalovelace-v2-final-draft");

        resume.meta.title = "a".repeat(200);
        expect(getResumeExportBaseName(resume)).toHaveLength(80);

        resume.meta.title = "///???";
        expect(getResumeExportBaseName(resume)).toBe("export");
    });

    it("keeps non-Latin names", () => {
        const resume = createEmptyResume();
        resume.basics.name = "Nerina Škejić";
        expect(getResumeExportBaseName(resume)).toBe("nerina-škejić");
    });
});
