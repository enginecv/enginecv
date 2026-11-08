import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { createEmptyResume } from "./schema";
import { duplicateResume } from "./resume-operations";

describe("resume operations", () => {
    afterEach(async () => {
        await db.resumes.clear();
        await db.resumeHistory.clear();
    });

    it("duplicates resume under new identity and records history", async () => {
        const source = createEmptyResume();
        source.meta.title = "Platform CV";

        const id = await duplicateResume(source, "Copy");
        const duplicate = await db.resumes.get(id);
        const history = await db.resumeHistory.where("resumeId").equals(id).toArray();

        expect(id).not.toBe(source.id);
        expect(duplicate?.meta.title).toBe("Platform CV (Copy)");
        expect(history).toHaveLength(1);
        expect(history[0].trigger).toBe("duplicate");
    });
});
