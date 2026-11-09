import { describe, expect, it } from "vitest";
import { getSampleResumeForTemplatePreview } from "./template-preview";

describe("template preview sample", () => {
    it("has no photo and no declaration by default", () => {
        const sample = getSampleResumeForTemplatePreview();
        expect(sample.basics.photo).toBeFalsy();
        expect(sample.declaration).toEqual([]);
        expect(sample.settings.language).toBe("en");
    });

    it("adds a placeholder photo when the template asks for one", () => {
        const sample = getSampleResumeForTemplatePreview({ photo: true });
        expect(sample.basics.photo).toMatch(/^data:image\/svg\+xml,/);
    });

    it("renders the German variant with every section plus the signature line", () => {
        const sample = getSampleResumeForTemplatePreview({ language: "de" });
        expect(sample.settings.language).toBe("de");
        // An explicit list renders only the listed sections, so all of them must be named.
        expect(sample.settings.contentSections).toEqual(
            expect.arrayContaining(["experience", "education", "projects", "skills", "languages", "declaration"]),
        );
        expect(sample.declaration[0]).toMatchObject({ place: "Berlin", fullName: "John Doe" });
        expect(sample.declaration[0].signature).toMatch(/^data:image\/svg\+xml,/);
    });
});
