import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { de as nurseDe } from "./examples/nurse.de";
import { createResumeFromContent, createResumeFromExample } from "./create-example";
import { getExampleRole } from "./examples";

describe("createResumeFromExample", () => {
    beforeEach(async () => {
        await db.resumes.clear();
        await db.resumeHistory.clear();
    });

    afterEach(async () => {
        await db.resumes.clear();
        await db.resumeHistory.clear();
    });

    it("stores one example resume with its title and a history entry", async () => {
        const id = await createResumeFromExample("nurse", "de", "Beispiel – Pflege");

        const rows = await db.resumes.toArray();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ id, meta: { title: "Beispiel – Pflege", tags: ["example"] } });
        expect(rows[0].basics.name).toBe("Jane Doe");
        // No reviewed German version yet: the content is English.
        expect(rows[0].settings.language).toBe("en");
        expect(await db.resumeHistory.where("resumeId").equals(id).count()).toBe(1);
    });

    it("creates a separate resume on every pick", async () => {
        const first = await createResumeFromExample("graduate", "en", "Example – Student or graduate");
        const second = await createResumeFromExample("graduate", "en", "Example – Student or graduate");

        expect(first).not.toBe(second);
        expect(await db.resumes.count()).toBe(2);
    });

    it("lets the page language choose the content over the visitor's UI language", async () => {
        const content = { ...(await getExampleRole("nurse").load()), de: nurseDe };

        const fromPage = await createResumeFromContent(content, "en", "Beispiel – Pflege", "de");
        const fromUi = await createResumeFromContent(content, "en", "Example – Nurse");

        const rows = await db.resumes.toArray();
        expect(rows.find((row) => row.id === fromPage)).toMatchObject({ settings: { language: "de" }, basics: { headline: expect.stringContaining("Krankenpflegerin") } });
        expect(rows.find((row) => row.id === fromUi)?.settings.language).toBe("en");
    });

    it("falls back to English when the page language has no content", async () => {
        const id = await createResumeFromContent(await getExampleRole("nurse").load(), "en", "Example", "de");
        expect((await db.resumes.get(id))?.settings.language).toBe("en");
    });
});
