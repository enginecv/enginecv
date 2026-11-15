import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { createEmptyResume } from "@/lib/schema";
import { useResumeStore } from "@/lib/store";
import { SECTIONS, previewSide, renderEditor, toggleSide, twoColumnResume } from "./section-placement.test.helpers";

// Feature 086: the side shown by a section's toggle must be the column the
// preview draws it in. Before the fix the section list re-normalised the
// already-resolved side with a stricter two-column rule and a different
// position, so a stored "left" at an odd position was shown as "right".

describe("section toggle matches the preview", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
        useResumeStore.setState({ resume: createEmptyResume() });
    });
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it("shows a stored left at an odd position as left, like the preview (the reported case)", async () => {
        const { container } = await renderEditor(twoColumnResume({ education: "left", projects: "left" }));

        for (const section of SECTIONS) {
            expect(toggleSide(section), `toggle for ${section}`).toBe(previewSide(container, section));
        }
        expect(previewSide(container, "education")).toBe("left");
        expect(toggleSide("education")).toBe("left");
        expect(toggleSide("projects")).toBe("left");
    });

    it("agrees for sections with nothing stored", async () => {
        const { container } = await renderEditor(twoColumnResume({}));

        for (const section of SECTIONS) {
            expect(toggleSide(section), `toggle for ${section}`).toBe(previewSide(container, section));
        }
    });

    it("agrees when a configured section with no content sits above the others", async () => {
        // "certificates" renders nothing, so the preview counts experience as the first section.
        const { container } = await renderEditor(twoColumnResume({}, "two", ["certificates"]));

        for (const section of SECTIONS) {
            expect(toggleSide(section), `toggle for ${section}`).toBe(previewSide(container, section));
        }
    });

    it("agrees in mixed mode for left, right and full", async () => {
        const { container } = await renderEditor(twoColumnResume({ experience: "full", education: "left", skills: "right", projects: "full" }, "mix"));

        for (const section of SECTIONS) {
            expect(toggleSide(section), `toggle for ${section}`).toBe(previewSide(container, section));
        }
    });
});
