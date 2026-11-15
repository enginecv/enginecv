import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { createEmptyResume } from "@/lib/schema";
import { useResumeStore } from "@/lib/store";
import { clickSide, previewSide, renderEditor, settle, toggleSide, twoColumnResume } from "./section-placement.test.helpers";

// Feature 086: one click on a side puts the section there; clicking the side a
// section is already stored on changes nothing.

describe("section placement control", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
        useResumeStore.setState({ resume: createEmptyResume() });
    });
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it("moves a section with one click per side and the toggle follows the preview every step", async () => {
        const { container, user, raf } = await renderEditor(twoColumnResume({ education: "left" }));

        for (const [side, expected] of [["Right", "right"], ["Left", "left"], ["Right", "right"], ["Left", "left"]] as const) {
            await clickSide(user, "education", side);
            await settle(container, raf);
            expect(useResumeStore.getState().resume.settings.layout.sectionPlacement.education).toBe(expected);
            expect(toggleSide("education")).toBe(expected);
            expect(previewSide(container, "education")).toBe(expected);
        }
    });

    it("the reported sequence: a section that looks left, then Right, ends on the right after one click", async () => {
        const { container, user, raf } = await renderEditor(twoColumnResume({ education: "left" }));
        expect(toggleSide("education")).toBe("left");
        expect(previewSide(container, "education")).toBe("left");

        await clickSide(user, "education", "Right");
        await settle(container, raf);

        expect(toggleSide("education")).toBe("right");
        expect(previewSide(container, "education")).toBe("right");
    });

    it("writes nothing when the clicked side is the stored one", async () => {
        const { user } = await renderEditor(twoColumnResume({ education: "right" }));
        const before = useResumeStore.getState().resume.settings.layout;

        await clickSide(user, "education", "Right");
        await clickSide(user, "education", "Right");

        expect(useResumeStore.getState().resume.settings.layout).toBe(before);
        expect(useResumeStore.getState().resume.settings.layout.sectionPlacement.education).toBe("right");
    });

    it("stores a side that was only shown by default when it is clicked, so later moves cannot change it", async () => {
        const { user } = await renderEditor(twoColumnResume({}));
        expect(useResumeStore.getState().resume.settings.layout.sectionPlacement.experience).toBeUndefined();
        expect(toggleSide("experience")).toBe("left");

        await clickSide(user, "experience", "Left");

        expect(useResumeStore.getState().resume.settings.layout.sectionPlacement.experience).toBe("left");
    });

    it("leaves every other section's side alone when one is changed", async () => {
        const { container, user, raf } = await renderEditor(twoColumnResume({ experience: "left", education: "right", skills: "left" }));

        await clickSide(user, "projects", "Right");
        await settle(container, raf);

        const placement = useResumeStore.getState().resume.settings.layout.sectionPlacement;
        expect(placement).toEqual({ experience: "left", education: "right", skills: "left", projects: "right" });
        for (const section of ["experience", "education", "skills", "projects"]) {
            expect(toggleSide(section)).toBe(previewSide(container, section));
        }
    });

    it("offers Full only in mixed mode and keeps it on click", async () => {
        const { container, user, raf } = await renderEditor(twoColumnResume({}, "mix"));

        await clickSide(user, "skills", "Full");
        await settle(container, raf);

        expect(useResumeStore.getState().resume.settings.layout.sectionPlacement.skills).toBe("full");
        expect(toggleSide("skills")).toBe("full");
        expect(previewSide(container, "skills")).toBe("full");
    });
});
