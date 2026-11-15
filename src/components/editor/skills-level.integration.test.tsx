import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { createEmptyResume, SKILL_LEVELS, type Resume } from "@/lib/schema";
import { useResumeStore } from "@/lib/store";
import { ResumePreview } from "./ResumePreview";

vi.setConfig({ testTimeout: 20_000 });

// Feature 085: the skill level meter is a CV-wide setting (on/off + style).

const skill = (id: string, name: string, level: string) => ({
    id, name, level, hidden: false, icon: "auto", display: "name", description: "", keywords: [],
});

function resumeWith(configure: (resume: Resume) => void = () => {}): Resume {
    const resume = createEmptyResume();
    resume.basics.name = "Jane Doe";
    resume.settings.contentSections = ["skills"];
    resume.skillGroups = [{
        id: "g1", name: "Tools", hidden: false,
        skills: [
            skill("a", "Alpha", "beginner"),
            skill("b", "Bravo", "competent"),
            skill("c", "Charlie", "expert"),
            skill("d", "Delta", ""),
            skill("e", "Echo", "unknown-level"),
        ],
    }] as never;
    configure(resume);
    return resume;
}

async function renderSkills(resume: Resume) {
    useResumeStore.setState({ resume, paperSize: "a4" });
    const { container } = render(<ResumePreview />);
    await waitFor(() => expect(container.querySelectorAll('[data-testid="resume-skill"]').length).toBe(5));
    const chips = Array.from(container.querySelectorAll<HTMLElement>('[data-testid="resume-skill"]'));
    const chip = (name: string) => chips.find((node) => node.textContent?.includes(name)) as HTMLElement;
    return { container, chip };
}

describe("skill level meter in the preview", () => {
    beforeEach(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
    afterEach(() => cleanup());

    it("draws five dots by default, filled up to the level, exactly as before", async () => {
        const { chip } = await renderSkills(resumeWith());
        const dots = (name: string) => chip(name).querySelector('[data-testid="resume-skill-level-dots"]') as HTMLElement;

        expect(dots("Alpha")).toHaveAttribute("aria-label", "Beginner");
        expect(dots("Alpha").children).toHaveLength(5);
        const opacity = (name: string) => Array.from(dots(name).children).map((dot) => (dot as HTMLElement).style.opacity);
        expect(opacity("Alpha")).toEqual(["1", "0.25", "0.25", "0.25", "0.25"]);
        expect(opacity("Bravo")).toEqual(["1", "1", "1", "0.25", "0.25"]);
        expect(opacity("Charlie")).toEqual(["1", "1", "1", "1", "1"]);
    });

    it("shows no meter for a skill without a level or with an unknown one, in any style", async () => {
        for (const levelStyle of ["dots", "bar", "text", "number"] as const) {
            const { chip } = await renderSkills(resumeWith((r) => { r.settings.skillsSection = { showLevels: true, levelStyle }; }));
            for (const name of ["Delta", "Echo"]) {
                expect(chip(name).querySelector('[data-testid^="resume-skill-level-"]'), `${levelStyle} ${name}`).toBeNull();
                expect(chip(name).textContent, `${levelStyle} ${name}`).toBe(name);
            }
            cleanup();
        }
    });

    it("draws a bar whose fill follows the level", async () => {
        const { chip } = await renderSkills(resumeWith((r) => { r.settings.skillsSection = { showLevels: true, levelStyle: "bar" }; }));
        const bar = (name: string) => within(chip(name)).getByTestId("resume-skill-level-bar");

        expect(bar("Alpha")).toHaveAttribute("aria-label", "Beginner");
        expect((bar("Alpha").firstElementChild as HTMLElement).style.width).toBe("20%");
        expect((bar("Bravo").firstElementChild as HTMLElement).style.width).toBe("60%");
        expect((bar("Charlie").firstElementChild as HTMLElement).style.width).toBe("100%");
        expect(within(chip("Alpha")).queryByTestId("resume-skill-level-text")).toBeNull();
    });

    it("writes the level in words, in the CV language rather than the app language", async () => {
        useI18nStore.setState({ locale: "fr", _hydrated: true });
        const { chip } = await renderSkills(resumeWith((r) => {
            r.settings.skillsSection = { showLevels: true, levelStyle: "text" };
            r.settings.language = "de";
        }));

        expect(within(chip("Alpha")).getByTestId("resume-skill-level-text")).toHaveTextContent("Anfänger");
        expect(within(chip("Charlie")).getByTestId("resume-skill-level-text")).toHaveTextContent("Experte");
    });

    it("writes the level as n/5", async () => {
        const { chip } = await renderSkills(resumeWith((r) => { r.settings.skillsSection = { showLevels: true, levelStyle: "number" }; }));

        expect(within(chip("Alpha")).getByTestId("resume-skill-level-number")).toHaveTextContent("1/5");
        expect(within(chip("Bravo")).getByTestId("resume-skill-level-number")).toHaveTextContent("3/5");
        expect(within(chip("Charlie")).getByTestId("resume-skill-level-number")).toHaveTextContent("5/5");
    });

    it("hides every meter when switched off, without touching the stored levels", async () => {
        const resume = resumeWith((r) => { r.settings.skillsSection = { showLevels: false, levelStyle: "text" }; });
        const { container, chip } = await renderSkills(resume);

        expect(container.querySelectorAll('[data-testid^="resume-skill-level-"]')).toHaveLength(0);
        expect(chip("Charlie").textContent).toBe("Charlie");
        expect(useResumeStore.getState().resume.skillGroups[0].skills.map((s) => s.level)).toEqual(["beginner", "competent", "expert", "", "unknown-level"]);
    });

    it("follows the Skills section's own override over the CV-wide setting", async () => {
        const { chip } = await renderSkills(resumeWith((r) => {
            r.settings.skillsSection = { showLevels: true, levelStyle: "dots" };
            r.customization.sectionOverrides.skills = { skillsSection: { levelStyle: "number" } };
        }));

        expect(within(chip("Bravo")).getByTestId("resume-skill-level-number")).toHaveTextContent("3/5");
    });

    it("covers every level in every style without error", async () => {
        const resume = resumeWith();
        resume.skillGroups[0].skills = SKILL_LEVELS.map((level, i) => skill(`s${i}`, `Skill${i}`, level)) as never;
        for (const levelStyle of ["dots", "bar", "text", "number"] as const) {
            resume.settings.skillsSection = { showLevels: true, levelStyle };
            useResumeStore.setState({ resume: { ...resume }, paperSize: "a4" });
            const { container } = render(<ResumePreview />);
            await waitFor(() => expect(container.querySelectorAll('[data-testid="resume-skill"]').length).toBe(5));
            expect(container.querySelectorAll('[data-testid^="resume-skill-level-"]').length, levelStyle).toBeGreaterThanOrEqual(5);
            cleanup();
        }
        expect(screen.queryByTestId("resume-skill")).toBeNull();
    });
});
