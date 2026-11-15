import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import { createEmptyResume } from "./schema";
import { useResumeStore } from "./store";

// The interactive preview publishes the side it drew for each section so the
// Customize section list can show exactly that (feature 086). The slice is
// ephemeral: never saved, cleared when an editor session starts.

describe("previewSectionPlacements", () => {
    beforeEach(() => {
        useResumeStore.setState({ previewSectionPlacements: {} });
    });
    afterEach(async () => {
        useResumeStore.setState({ previewSectionPlacements: {} });
        await db.resumes.clear();
    });

    it("starts empty", () => {
        expect(useResumeStore.getState().previewSectionPlacements).toEqual({});
    });

    it("stores the published map", () => {
        useResumeStore.getState().setPreviewSectionPlacements({ experience: "left", skills: "right" });
        expect(useResumeStore.getState().previewSectionPlacements).toEqual({ experience: "left", skills: "right" });
    });

    it("does not change state when the same sides are published again", () => {
        useResumeStore.getState().setPreviewSectionPlacements({ experience: "left", skills: "right" });
        const before = useResumeStore.getState();

        useResumeStore.getState().setPreviewSectionPlacements({ skills: "right", experience: "left" });

        expect(useResumeStore.getState()).toBe(before);
        expect(useResumeStore.getState().previewSectionPlacements).toBe(before.previewSectionPlacements);
    });

    it("updates when a side or the set of sections changes", () => {
        useResumeStore.getState().setPreviewSectionPlacements({ experience: "left" });
        useResumeStore.getState().setPreviewSectionPlacements({ experience: "right" });
        expect(useResumeStore.getState().previewSectionPlacements).toEqual({ experience: "right" });

        useResumeStore.getState().setPreviewSectionPlacements({ experience: "right", skills: "left" });
        expect(useResumeStore.getState().previewSectionPlacements).toEqual({ experience: "right", skills: "left" });

        useResumeStore.getState().setPreviewSectionPlacements({});
        expect(useResumeStore.getState().previewSectionPlacements).toEqual({});
    });

    it("is cleared when another resume is loaded into the editor", async () => {
        const resume = createEmptyResume();
        resume.id = "placement-reset";
        await db.resumes.put({ ...resume, updatedAt: Date.now() });
        useResumeStore.getState().setPreviewSectionPlacements({ experience: "right" });

        await useResumeStore.getState().loadFromDb("placement-reset");

        expect(useResumeStore.getState().previewSectionPlacements).toEqual({});
    });

    it("is not part of the saved resume", async () => {
        const resume = createEmptyResume();
        resume.id = "placement-saved";
        useResumeStore.setState({ resume, activeResumeId: "placement-saved", persistenceSuspended: false });
        useResumeStore.getState().setPreviewSectionPlacements({ experience: "right" });

        await useResumeStore.getState().saveToDb();

        const saved = await db.resumes.get("placement-saved");
        expect(JSON.stringify(saved)).not.toContain("previewSectionPlacements");
    });
});
