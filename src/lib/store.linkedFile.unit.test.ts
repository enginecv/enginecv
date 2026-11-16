import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { createEmptyResume } from "./schema";
import { useResumeStore } from "./store";

beforeEach(() => useResumeStore.getState().resetLinkedFile());

describe("linkedFile slice", () => {
    it("starts unlinked", () => {
        expect(useResumeStore.getState().linkedFile).toMatchObject({ status: "none", fileName: null, error: null });
    });

    it("merges patches and resets", () => {
        useResumeStore.getState().setLinkedFile({ status: "in-sync", fileName: "a.enginecv.json" });
        useResumeStore.getState().setLinkedFile({ lastSyncedAt: 5 });
        expect(useResumeStore.getState().linkedFile).toMatchObject({ status: "in-sync", fileName: "a.enginecv.json", lastSyncedAt: 5 });
        useResumeStore.getState().resetLinkedFile();
        expect(useResumeStore.getState().linkedFile.status).toBe("none");
    });

    it("is cleared when a resume opens", async () => {
        await db.resumes.put({ ...createEmptyResume(), id: "cv-open" });
        useResumeStore.getState().setLinkedFile({ status: "in-sync", fileName: "a.json" });
        await useResumeStore.getState().loadFromDb("cv-open");
        expect(useResumeStore.getState().linkedFile.status).toBe("none");
    });
});
