import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { useResumeStore } from "@/lib/store";

describe("creating a blank resume", () => {
    beforeEach(async () => {
        await db.resumes.clear();
    });

    it("starts in the app language, with that language's date format", async () => {
        const id = await useResumeStore.getState().createNew({ language: "de" });
        const row = await db.resumes.get(id);
        expect(row?.settings.language).toBe("de");
        expect(row?.settings.dateFormat).toBe("DD.MM.YYYY");
    });

    it("stays English without a language, or with one a CV cannot be written in", async () => {
        const plain = await db.resumes.get(await useResumeStore.getState().createNew());
        const odd = await db.resumes.get(await useResumeStore.getState().createNew({ language: "xx" }));
        expect(plain?.settings.language).toBe("en");
        expect(odd?.settings.language).toBe("en");
    });
});
