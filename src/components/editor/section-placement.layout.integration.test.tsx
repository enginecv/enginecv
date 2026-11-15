import { act, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { createEmptyResume, type Resume } from "@/lib/schema";
import { useResumeStore } from "@/lib/store";
import { SECTIONS, previewSide, renderEditor, settle, toggleSide, twoColumnResume } from "./section-placement.test.helpers";

// These render the whole editor (preview + sidebar) and take 1-2 s alone; give them room when
// the full suite runs in parallel.
vi.setConfig({ testTimeout: 20_000 });

// Feature 086, story 2: layout switches and edits never change a side the user
// chose, and the toggle matches the page after each of them.

type Raf = { flushAll: () => Promise<void> };

async function switchColumns(user: ReturnType<typeof userEvent.setup>, container: HTMLElement, raf: Raf, label: "One" | "Two" | "Mix") {
    await user.click(screen.getByRole("button", { name: label }));
    // The one-column preview has no structured measure container to size.
    if (label === "One") await raf.flushAll();
    else await settle(container, raf);
}

async function edit(container: HTMLElement, raf: Raf, change: (resume: Resume) => Resume) {
    await act(async () => {
        useResumeStore.setState({ resume: change(useResumeStore.getState().resume) });
    });
    await settle(container, raf);
}

function expectAgree(container: HTMLElement, keys: readonly string[]) {
    for (const key of keys) {
        expect(toggleSide(key), `toggle for ${key}`).toBe(previewSide(container, key));
    }
}

const chosen = () => useResumeStore.getState().resume.settings.layout.sectionPlacement;

describe("section placement across layout switches and edits", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
        useResumeStore.setState({ resume: createEmptyResume() });
    });
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it("keeps chosen left and right sides through one, two and mixed round trips", async () => {
        const { container, user, raf } = await renderEditor(twoColumnResume({ education: "left", skills: "right", projects: "left" }));
        const original = { ...chosen() };

        await switchColumns(user, container, raf, "Mix");
        await switchColumns(user, container, raf, "Two");
        await switchColumns(user, container, raf, "One");
        await switchColumns(user, container, raf, "Two");

        expect(chosen()).toEqual(original);
        expectAgree(container, SECTIONS);
        expect(previewSide(container, "education")).toBe("left");
        expect(previewSide(container, "skills")).toBe("right");
    });

    it("puts a full-width section in the column its position gives when leaving mixed mode, and back to full on return", async () => {
        const { container, user, raf } = await renderEditor(twoColumnResume({ skills: "full" }, "mix"));
        expect(previewSide(container, "skills")).toBe("full");

        await switchColumns(user, container, raf, "Two");
        // experience 0 left, education 1 right, skills 2 left by position
        expect(previewSide(container, "skills")).toBe("left");
        expect(toggleSide("skills")).toBe("left");
        expect(chosen().skills).toBe("full");

        await switchColumns(user, container, raf, "Mix");
        expect(previewSide(container, "skills")).toBe("full");
        expect(toggleSide("skills")).toBe("full");
    });

    it("reordering sections does not change a side the user chose", async () => {
        const { container, raf } = await renderEditor(twoColumnResume({ education: "left", projects: "right" }));

        await edit(container, raf, (resume) => ({
            ...resume,
            settings: { ...resume.settings, layout: { ...resume.settings.layout, sectionOrder: ["projects", "skills", "education", "experience"] } },
        }));

        expect(previewSide(container, "education")).toBe("left");
        expect(previewSide(container, "projects")).toBe("right");
        expectAgree(container, SECTIONS);
        expect(chosen()).toEqual({ education: "left", projects: "right" });
    });

    it("hiding a section keeps the other sections' chosen sides and the toggle in agreement", async () => {
        const { container, raf } = await renderEditor(twoColumnResume({ education: "left", skills: "right" }));

        await edit(container, raf, (resume) => ({
            ...resume,
            settings: { ...resume.settings, hiddenSections: ["experience"] },
        }));

        expect(previewSide(container, "education")).toBe("left");
        expect(previewSide(container, "skills")).toBe("right");
        expectAgree(container, ["education", "skills", "projects"]);
    });

    it("removing a section deletes only its side and leaves the others in agreement", async () => {
        const { container, raf } = await renderEditor(twoColumnResume({ education: "left", skills: "right", projects: "left" }));

        await edit(container, raf, (resume) => {
            const { skills: _removed, ...rest } = resume.settings.layout.sectionPlacement;
            void _removed;
            return {
                ...resume,
                skillGroups: [],
                settings: {
                    ...resume.settings,
                    contentSections: resume.settings.contentSections.filter((key) => key !== "skills"),
                    layout: { ...resume.settings.layout, sectionOrder: resume.settings.layout.sectionOrder.filter((key) => key !== "skills"), sectionPlacement: rest },
                },
            };
        });

        expect(chosen()).toEqual({ education: "left", projects: "left" });
        expect(previewSide(container, "education")).toBe("left");
        expect(previewSide(container, "projects")).toBe("left");
        expectAgree(container, ["experience", "education", "projects"]);
    });

    it("after the Sidebar template is applied, the toggles still match the preview", async () => {
        const { container, raf } = await renderEditor(twoColumnResume({ projects: "left" }));

        await act(async () => {
            await useResumeStore.getState().applyTemplateById("enginecv-sidebar");
        });
        await settle(container, raf);

        // The template sets skills left and experience, education and projects right.
        expect(previewSide(container, "skills")).toBe("left");
        expect(previewSide(container, "experience")).toBe("right");
        expectAgree(container, SECTIONS);
    });

    it("separators and page breaks in the flow do not change any default side", async () => {
        const { container, raf } = await renderEditor(twoColumnResume({}));
        const before = SECTIONS.map((key) => previewSide(container, key));

        await edit(container, raf, (resume) => ({
            ...resume,
            settings: {
                ...resume.settings,
                layout: { ...resume.settings.layout, sectionOrder: ["experience", "separator:one", "education", "pagebreak:two", "skills", "projects"] },
            },
        }));

        expect(SECTIONS.map((key) => previewSide(container, key))).toEqual(before);
        expectAgree(container, SECTIONS);
    });
});
