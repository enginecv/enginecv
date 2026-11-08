import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/en";
import { isCefrLevel } from "@/lib/cefr";
import { buildExampleResume } from "../create-example";
import { EXAMPLE_ROLE_IDS, EXAMPLE_ROLES, resolveExampleContent } from ".";
import type { ExampleContent } from "./types";

const loaded: Array<[string, ExampleContent]> = await Promise.all(
    EXAMPLE_ROLES.map(async (role) => [role.id, await role.load()] as [string, ExampleContent]),
);

const cases = loaded.flatMap(([roleId, content]) =>
    Object.keys(content).map((locale) => [roleId, locale, content] as const),
);

describe("example roles", () => {
    it("are registered in a fixed order with translated names", () => {
        expect(EXAMPLE_ROLES.map((role) => role.id)).toEqual([...EXAMPLE_ROLE_IDS]);
        for (const role of EXAMPLE_ROLES) {
            expect(en[role.titleKey], role.titleKey).toBeTruthy();
            expect(en[role.hintKey], role.hintKey).toBeTruthy();
        }
    });

    it("all ship English content", () => {
        for (const [roleId, content] of loaded) expect(typeof content.en, roleId).toBe("function");
    });
});

describe.each(cases)("%s (%s)", (_roleId, locale, content) => {
    const input = content[locale as keyof ExampleContent]!();
    const resume = buildExampleResume(input, "en", "Example – test", 1_000);

    it("is a valid, complete resume", () => {
        expect(resume.basics.name).not.toBe("");
        expect(resume.basics.headline).not.toBe("");
        expect(resume.basics.summary).not.toBe("");
        expect(resume.experience.length).toBeGreaterThanOrEqual(1);
        expect(resume.education.length).toBeGreaterThanOrEqual(1);
        expect(resume.skillGroups.flatMap((group) => group.skills).length).toBeGreaterThanOrEqual(1);
        expect(resume.meta).toMatchObject({ title: "Example – test", tags: ["example"] });
        expect(resume.settings.contentSections).toEqual(resume.settings.layout.sectionOrder);
        expect(resume.settings.contentSections).toEqual(expect.arrayContaining(["experience", "education", "skills", "languages"]));
    });

    it("rates every non-native language skill by skill on the CEFR scale", () => {
        expect(resume.languages.length).toBeGreaterThanOrEqual(2);
        const rated = resume.languages.filter((language) => language.cefrDetailed);
        expect(rated.length).toBeGreaterThanOrEqual(1);
        for (const language of rated) {
            expect(isCefrLevel(language.fluency), language.language).toBe(true);
            for (const level of Object.values(language.cefr)) expect(isCefrLevel(level), language.language).toBe(true);
        }
    });

    it("uses fictional contact details", () => {
        expect(resume.basics.email).toMatch(/@example\.com$/);
        for (const entry of resume.basics.emails ?? []) expect(entry.email).toMatch(/@example\.com$/);
        expect(resume.basics.phone).toMatch(/^\+387 6\d 000 00\d$/);
    });
});

describe("resolveExampleContent", () => {
    it("falls back to English when the visitor's language has no reviewed version", () => {
        const content: ExampleContent = { en: () => loaded[0][1].en() };
        expect(resolveExampleContent(content, "de").locale).toBe("en");
    });

    it("uses a translated version when one exists", () => {
        const german = loaded[0][1].en();
        const content: ExampleContent = { en: () => loaded[0][1].en(), de: () => german };
        expect(resolveExampleContent(content, "de")).toEqual({ locale: "de", input: german });
    });
});
