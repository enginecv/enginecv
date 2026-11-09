import { db } from "@/lib/db";
import { recordResumeHistory } from "@/lib/history";
import { createId } from "@/lib/id";
import type { Locale } from "@/lib/i18n/locales";
import { withDefaultDesign } from "@/lib/templates/default-design";
import { resumeSchema, type Resume } from "@/lib/schema";
import { getExampleRole, resolveExampleContent, type ExampleContent, type ExampleResumeInput, type ExampleRoleId } from "./examples";

const EXAMPLE_SECTION_ORDER = ["experience", "education", "languages", "skills", "projects"] as const;

/** Sections the example fills, in reading order. */
function filledSections(input: ExampleResumeInput): string[] {
    const filled: Record<(typeof EXAMPLE_SECTION_ORDER)[number], boolean> = {
        experience: input.experience.length > 0,
        education: input.education.length > 0,
        projects: (input.projects?.length ?? 0) > 0,
        skills: input.skillGroups.some((group) => group.skills.length > 0),
        languages: input.languages.length > 0,
    };
    return EXAMPLE_SECTION_ORDER.filter((section) => filled[section]);
}

/** A complete, schema-valid resume from an example's content. Pure; exported for tests. */
export function buildExampleResume(input: ExampleResumeInput, contentLocale: Locale, title: string, now: number, id = createId()): Resume {
    const sections = filledSections(input);
    const { description, ...content } = input;
    const resume = resumeSchema.parse({
        ...content,
        id,
        createdAt: now,
        updatedAt: now,
        meta: { title, description, tags: ["example"] },
        settings: {
            language: contentLocale,
            contentSections: sections,
            layout: { sectionOrder: sections },
            // Show off the CEFR grid: every example rates its languages skill by skill.
            sectionDisplay: { languages: { languageLayout: "cefr" } },
        },
    });
    // Examples open in the default design; their language, sections, section order
    // and CEFR grid stay exactly as set above.
    const designed = withDefaultDesign(resume);
    return {
        ...designed,
        settings: { ...designed.settings, layout: { ...designed.settings.layout, sectionOrder: resume.settings.layout.sectionOrder } },
    };
}

/**
 * Stores a new resume from example content and returns its id. `contentLocale`
 * is the language of the CV text; when given (role example pages, where the
 * page language wins) it replaces the visitor's UI language as the choice of version.
 */
export async function createResumeFromContent(content: ExampleContent, uiLocale: Locale, title: string, contentLocale?: Locale): Promise<string> {
    const { locale, input } = resolveExampleContent(content, contentLocale ?? uiLocale);
    const id = createId();
    const resume = buildExampleResume(input, locale, title, Date.now(), id);

    await db.resumes.add(resume);
    try {
        await recordResumeHistory(resume, "manual");
    } catch (cause) {
        // A failed copy must leave nothing behind, or pressing the button again would duplicate it.
        await db.resumes.delete(id);
        throw cause;
    }

    return id;
}

/** Stores a new resume from an example role and returns its id (like `createResumeFromTemplate`). */
export async function createResumeFromExample(roleId: ExampleRoleId, uiLocale: Locale, title: string, contentLocale?: Locale): Promise<string> {
    return createResumeFromContent(await getExampleRole(roleId).load(), uiLocale, title, contentLocale);
}
