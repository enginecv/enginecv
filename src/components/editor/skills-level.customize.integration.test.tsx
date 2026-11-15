import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useI18nStore } from "@/lib/i18n";
import { createEmptyResume } from "@/lib/schema";
import { useResumeStore } from "@/lib/store";
import { EditorSidebar } from "./EditorSidebar";

vi.setConfig({ testTimeout: 20_000 });

// Feature 085: Customize controls for the skill level meter, and the hint in the skill form.

async function openSkillsCustomize(locale = "en") {
    useI18nStore.setState({ locale: locale as never, _hydrated: true });
    const resume = createEmptyResume();
    resume.settings.contentSections = ["skills"];
    useResumeStore.setState({ resume, sidebarTab: "content" });
    render(<TooltipProvider><EditorSidebar /></TooltipProvider>);
    const user = userEvent.setup();
    await user.click(screen.getByTestId("sidebar-tab-customize"));
    await user.click(await screen.findByTestId("customize-row-skillsSection"));
    return { user, controls: await screen.findByTestId("skills-section-controls") };
}

const settings = () => useResumeStore.getState().resume.settings.skillsSection;

describe("skills level meter controls", () => {
    beforeEach(() => useResumeStore.setState({ resume: createEmptyResume() }));
    afterEach(() => cleanup());

    it("switches the meter off and on, keeping the chosen style", async () => {
        const { user, controls } = await openSkillsCustomize();
        expect(settings()).toEqual({ showLevels: true, levelStyle: "dots" });

        await user.click(within(controls).getByTestId("skills-level-style-bar"));
        expect(settings()).toEqual({ showLevels: true, levelStyle: "bar" });

        await user.click(within(controls).getByRole("checkbox", { name: "Show skill levels" }));
        expect(settings().showLevels).toBe(false);
        expect(within(controls).queryByTestId("skills-level-style-bar")).toBeNull();

        await user.click(within(controls).getByRole("checkbox", { name: "Show skill levels" }));
        expect(settings()).toEqual({ showLevels: true, levelStyle: "bar" });
    });

    it("offers all four styles with the current one pressed", async () => {
        const { user, controls } = await openSkillsCustomize();
        for (const style of ["dots", "bar", "text", "number"]) {
            await user.click(within(controls).getByTestId(`skills-level-style-${style}`));
            expect(within(controls).getByTestId(`skills-level-style-${style}`)).toHaveAttribute("aria-pressed", "true");
            expect(within(controls).getAllByRole("button", { pressed: true })).toHaveLength(1);
            expect(settings().levelStyle).toBe(style);
        }
    });

    it("shows the labels in the app language", async () => {
        const { controls } = await openSkillsCustomize("de");
        expect(within(controls).getByRole("checkbox", { name: "Kompetenzstufen anzeigen" })).toBeInTheDocument();
        expect(within(controls).getByTestId("skills-level-style-bar")).toHaveTextContent("Balken");
    });
});
