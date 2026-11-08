import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createId } from "@/lib/id";
import { createEmptyResume, languageSchema, resumeSchema } from "@/lib/schema";
import { assessmentToLanguage } from "@/lib/tools/cefr-assessment";
import { saveAssessmentToNewResume, saveAssessmentToResume } from "@/lib/tools/save-assessment";

const german = assessmentToLanguage({ language: "German", levels: { listening: "B2", reading: "B1" } });

async function storeResume(languages: Array<Record<string, unknown>> = []) {
    const id = createId();
    await db.resumes.add(resumeSchema.parse({
        ...createEmptyResume(),
        id,
        createdAt: 1,
        updatedAt: 1,
        languages: languages.map((language) => languageSchema.parse(language)),
    }));
    return id;
}

describe("saving a CEFR self-assessment", () => {
    beforeEach(async () => {
        await db.resumes.clear();
        await db.resumeHistory.clear();
    });

    afterEach(async () => {
        await db.resumes.clear();
        await db.resumeHistory.clear();
    });

    it("creates a new resume with the language and a history entry", async () => {
        const id = await saveAssessmentToNewResume(german);
        const saved = await db.resumes.get(id);
        expect(saved?.languages.map((language) => language.language)).toEqual(["German"]);
        expect(saved?.languages[0].cefr.listening).toBe("B2");
        expect(await db.resumeHistory.where("resumeId").equals(id).count()).toBe(1);
    });

    it("updates the same language in an existing resume and records the change", async () => {
        const id = await storeResume([{ language: "German", fluency: "A2" }, { language: "English", fluency: "C1" }]);

        expect(await saveAssessmentToResume(id, german)).toBe("updated");

        const saved = await db.resumes.get(id);
        expect(saved?.languages).toHaveLength(2);
        expect(saved?.languages[0]).toMatchObject({ language: "German", fluency: "B1", cefrDetailed: true });
        expect(saved?.updatedAt).toBeGreaterThan(1);
        expect(await db.resumeHistory.where("resumeId").equals(id).count()).toBe(1);
    });

    it("leaves a resume untouched when the language is a mother tongue", async () => {
        const id = await storeResume([{ language: "German", fluency: "Native" }]);

        expect(await saveAssessmentToResume(id, german)).toBe("native");

        expect((await db.resumes.get(id))?.updatedAt).toBe(1);
        expect(await db.resumeHistory.where("resumeId").equals(id).count()).toBe(0);
    });

    it("fails for a resume that no longer exists", async () => {
        await expect(saveAssessmentToResume("missing", german)).rejects.toThrow("not found");
    });
});
