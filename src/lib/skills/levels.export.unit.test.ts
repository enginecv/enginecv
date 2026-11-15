import { describe, expect, it } from "vitest";
import { toDocumentModel, formatDocumentSkills } from "@/lib/document-model";
import { toMarkdown } from "@/lib/export-markdown";
import { toPlainText } from "@/lib/export-plaintext";
import { createEmptyResume, type Resume } from "@/lib/schema";
import { getBuiltinTemplateById } from "@/lib/templates/enginecv-templates";
import { applyTemplateToResume } from "@/lib/templates/template-apply";

function skillsResume(language = "en"): Resume {
    const resume = createEmptyResume();
    resume.settings.language = language;
    resume.settings.contentSections = ["skills"];
    const skill = (id: string, name: string, level: string, hidden = false) => ({
        id, name, level, hidden, icon: "auto", display: "both", description: "", keywords: [],
    });
    resume.skillGroups = [{
        id: "g1", name: "Languages", hidden: false,
        skills: [skill("a", "Python", "expert"), skill("b", "Go", ""), skill("c", "Rust", "bogus"), skill("d", "Lua", "beginner")],
    }] as never;
    return resume;
}

describe("skill levels in the text exports", () => {
    it("states levels in words when the meter is on, and only for known levels", () => {
        const model = toDocumentModel(skillsResume());
        const group = model.sections[0].skillGroups[0];
        expect(group.skills).toEqual(["Python", "Go", "Rust", "Lua"]);
        expect(formatDocumentSkills(group)).toEqual(["Python (Expert)", "Go", "Rust", "Lua (Beginner)"]);
        expect(toMarkdown(model)).toContain("Python (Expert)");
        expect(toPlainText(model)).toContain("Python (Expert), Go, Rust, Lua (Beginner)");
    });

    it("omits levels everywhere when the meter is off, and leaves stored levels alone", () => {
        const resume = skillsResume();
        resume.settings.skillsSection = { showLevels: false, levelStyle: "dots" };
        const model = toDocumentModel(resume);
        expect(formatDocumentSkills(model.sections[0].skillGroups[0])).toEqual(["Python", "Go", "Rust", "Lua"]);
        expect(toMarkdown(model)).not.toMatch(/Expert|Beginner/);
        expect(toPlainText(model)).not.toMatch(/Expert|Beginner/);
        expect(resume.skillGroups[0].skills[0].level).toBe("expert");
    });

    it("uses the CV language, not the app language", () => {
        expect(toPlainText(toDocumentModel(skillsResume("de")))).toContain("Python (Experte)");
        expect(toPlainText(toDocumentModel(skillsResume("bs")))).toContain("Python (Stručnjak)");
    });

    it("follows a per-section override", () => {
        const resume = skillsResume();
        resume.customization.sectionOverrides.skills = { skillsSection: { showLevels: false } };
        expect(toPlainText(toDocumentModel(resume))).not.toContain("Expert");
    });

    it("ATS Plain turns the meter off and other templates leave the user's choice alone", () => {
        const ats = getBuiltinTemplateById("enginecv-compact")!;
        expect(ats.settings.skillsSection.showLevels).toBe(false);

        const resume = skillsResume();
        resume.settings.skillsSection = { showLevels: true, levelStyle: "number" };
        expect(applyTemplateToResume(resume, ats).resume.settings.skillsSection.showLevels).toBe(false);

        const modern = getBuiltinTemplateById("enginecv-modern") ?? getBuiltinTemplateById("enginecv-sidebar")!;
        expect(modern.settings.skillsSection).toEqual({ showLevels: true, levelStyle: "dots" });
        expect(applyTemplateToResume(resume, modern).resume.settings.skillsSection).toEqual({ showLevels: true, levelStyle: "number" });
    });
});
