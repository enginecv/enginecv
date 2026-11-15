import { describe, expect, it } from "vitest";
import { importResumeFromJsonText } from "@/lib/export";
import { createEmptyResume } from "@/lib/schema";

async function importRestored(text: string) {
    const result = await importResumeFromJsonText(text);
    if (!result || result.kind !== "resume") throw new Error(`expected a resume import, got ${result?.kind ?? "nothing"}`);
    return result.resume;
}

// The "Your data" download and the dashboard import both go through the resume
// JSON, so a round trip here covers the download -> re-import path for the new
// Interests settings (FR-017).
describe("Interests settings round trip", () => {
    it("keeps the chosen style and options through a JSON export and re-import", async () => {
        const resume = createEmptyResume();
        resume.interests = [
            { id: "i1", hidden: false, name: "Chess", description: "Club player" },
            { id: "i2", hidden: false, name: "Hiking", description: "" },
        ];
        resume.settings.interestsSection = { display: "iconGrid", showIcons: false, columns: 2, separator: "pipe" };

        const restored = await importRestored(JSON.stringify(resume));

        expect(restored.settings.interestsSection).toEqual({
            display: "iconGrid",
            showIcons: false,
            columns: 2,
            separator: "pipe",
        });
        expect(restored.interests.map((interest) => interest.name)).toEqual(["Chess", "Hiking"]);
        expect(restored.interests[0].description).toBe("Club player");
    });

    it("imports a file from before the feature and falls back to today's list look", async () => {
        const resume = createEmptyResume();
        const legacy = JSON.parse(JSON.stringify(resume));
        delete legacy.settings.interestsSection;

        const restored = await importRestored(JSON.stringify(legacy));

        expect(restored.settings.interestsSection).toEqual({
            display: "list",
            showIcons: true,
            columns: 3,
            separator: "dot",
        });
    });

    it("does not reject a file whose Interests settings hold unknown values", async () => {
        const resume = createEmptyResume();
        const broken = JSON.parse(JSON.stringify(resume));
        broken.settings.interestsSection = { display: "cards", columns: 12, separator: "star", showIcons: "maybe" };

        const restored = await importRestored(JSON.stringify(broken));

        expect(restored.settings.interestsSection).toEqual({
            display: "list",
            showIcons: true,
            columns: 3,
            separator: "dot",
        });
    });
});
