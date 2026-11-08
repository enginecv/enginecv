import type { Locale } from "@/lib/i18n/locales";
import type { Basics, Education, Experience, Language, Project, Skill, SkillGroup } from "@/lib/schema";

/**
 * The content of one example CV in one language. Ids, timestamps, the title and
 * settings are added when a resume is created from it (`createResumeFromExample`).
 * People, employers and contact details are fictional.
 */
export type ExampleResumeInput = {
    description: string;
    basics: Partial<Basics>;
    experience: Partial<Experience>[];
    education: Partial<Education>[];
    projects?: Partial<Project>[];
    skillGroups: (Partial<Omit<SkillGroup, "skills">> & { skills: Partial<Skill>[] })[];
    languages: Partial<Language>[];
};

/** One function per content language; `en` is required and is the fallback. */
export type ExampleContent = { en: () => ExampleResumeInput } & Partial<Record<Locale, () => ExampleResumeInput>>;
