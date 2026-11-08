import { createEmptyResume } from "./schema";
import { describe, expect, it } from "vitest";
import {
    duplicateContentEntry,
    removeContentEntry,
    removeContentSection,
    toggleContentEntryHidden,
    toggleContentSectionHidden,
} from "./content-operations";

function seededResume() {
    const resume = createEmptyResume();
    resume.settings.contentSections = ["experience", "education"];
    resume.experience = [{
        id: "exp-1",
        hidden: false,
        position: "Engineer",
        company: "Acme",
        start: "",
        end: "",
        location: "",
        description: "",
        highlights: [],
        skills: [],
        url: "",
        urlIcon: "auto",
    }];
    return resume;
}

describe("content operations", () => {
    it("toggles section and entry visibility immutably", () => {
        const resume = seededResume();
        const hiddenSection = toggleContentSectionHidden(resume, "experience");
        const hiddenEntry = toggleContentEntryHidden(resume, "experience", 0);

        expect(hiddenSection.settings.hiddenSections).toContain("experience");
        expect(hiddenEntry.experience[0].hidden).toBe(true);
        expect(resume.settings.hiddenSections).toEqual([]);
        expect(resume.experience[0].hidden).toBe(false);
    });

    it("duplicates and removes exact entries", () => {
        const resume = seededResume();
        const duplicated = duplicateContentEntry(resume, "experience", 0);
        const removed = removeContentEntry(duplicated, "experience", 0);

        expect(duplicated.experience).toHaveLength(2);
        expect(duplicated.experience[1].id).not.toBe("exp-1");
        expect(removed.experience).toHaveLength(1);
        expect(removed.experience[0].id).toBe(duplicated.experience[1].id);
    });

    it("removes section configuration and owned data", () => {
        const removed = removeContentSection(seededResume(), "experience");

        expect(removed.settings.contentSections).toEqual(["education"]);
        expect(removed.experience).toEqual([]);
    });
});
