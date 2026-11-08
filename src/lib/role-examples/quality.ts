import type { Resume } from "@/lib/schema";
import { ROLE_EXAMPLE_LOCALES, type RoleExample, type RoleExampleLocale, type RoleProse } from "./registry";

/*
 * Quality gate for role example pages. Thin or copied pages get penalised by
 * search engines, so the rules below turn "unique, human-reviewed text" into
 * something CI can fail on. Human review itself is the `draft` flag.
 *
 * Pure: callers resolve prose, CVs, templates and blog articles and pass them in.
 */

export const MIN_TIPS = 3;
export const MAX_TIPS = 5;
export const MIN_SKILLS = 6;
export const MIN_WORDS = 250;
export const MIN_DESCRIPTION = 120;
export const MAX_DESCRIPTION = 160;

/** Fictional contact data only: the reserved example domain and a range no real phone uses. */
export const FICTIONAL_EMAIL = /@example\.com$/;
export const FICTIONAL_PHONE = /^\+387 6\d 000 00\d$/;

export interface RoleExampleResolved {
    role: RoleExample;
    prose: Partial<Record<RoleExampleLocale, RoleProse>>;
    /** The built CV per language the role has content for. */
    resumes: Partial<Record<RoleExampleLocale, Resume>>;
}

export interface QualityContext {
    templateSlugs: ReadonlySet<string>;
    /** Blog `article` ids with at least one published version. */
    publishedArticleIds: ReadonlySet<string>;
}

function words(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
}

export function proseWordCount(prose: RoleProse): number {
    return words(prose.intro) + prose.tips.reduce((sum, tip) => sum + words(tip), 0) + prose.skills.reduce((sum, skill) => sum + words(skill), 0);
}

function normalise(text: string): string {
    return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Problems with one role; empty when it passes. Drafts are held to the same structure rules as published versions. */
export function checkRole(resolved: RoleExampleResolved, context: QualityContext): string[] {
    const { role, prose, resumes } = resolved;
    const problems: string[] = [];
    const fail = (message: string) => problems.push(`${role.id}: ${message}`);

    if (!context.templateSlugs.has(role.template)) fail(`template "${role.template}" is not a gallery template`);
    if (!context.publishedArticleIds.has(role.relatedArticle)) fail(`related article "${role.relatedArticle}" has no published version`);
    if (Object.keys(role.versions).length === 0) fail("has no language version");

    for (const locale of ROLE_EXAMPLE_LOCALES) {
        const version = role.versions[locale];
        if (!version) continue;
        const where = `${role.id} (${locale})`;
        const text = prose[locale];

        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(version.slug)) problems.push(`${where}: slug "${version.slug}" is not kebab-case ASCII`);
        if (version.description.length < MIN_DESCRIPTION || version.description.length > MAX_DESCRIPTION) {
            problems.push(`${where}: description is ${version.description.length} characters, expected ${MIN_DESCRIPTION}–${MAX_DESCRIPTION}`);
        }
        if (!text) {
            problems.push(`${where}: no prose`);
            continue;
        }
        if (text.tips.length < MIN_TIPS || text.tips.length > MAX_TIPS) problems.push(`${where}: ${text.tips.length} tips, expected ${MIN_TIPS}–${MAX_TIPS}`);
        if (text.skills.length < MIN_SKILLS) problems.push(`${where}: ${text.skills.length} skills, expected at least ${MIN_SKILLS}`);
        if (version.status === "published" && proseWordCount(text) < MIN_WORDS) {
            problems.push(`${where}: ${proseWordCount(text)} words of prose, expected at least ${MIN_WORDS} when published`);
        }

        const resume = resumes[locale];
        if (!resume) {
            problems.push(`${where}: no example CV in this language`);
            continue;
        }
        const emails = [resume.basics.email, ...(resume.basics.emails ?? []).map((entry) => entry.email)].filter(Boolean);
        for (const email of emails) if (!FICTIONAL_EMAIL.test(email)) problems.push(`${where}: email "${email}" is not an @example.com address`);
        if (resume.basics.phone && !FICTIONAL_PHONE.test(resume.basics.phone)) problems.push(`${where}: phone "${resume.basics.phone}" is outside the fictional range`);
    }

    return problems;
}

/** Problems across roles: duplicated slugs, titles, descriptions and tips. */
export function checkRegistry(resolved: readonly RoleExampleResolved[]): string[] {
    const problems: string[] = [];
    const seen = new Map<string, string>();
    const claim = (kind: string, key: string, owner: string) => {
        const id = `${kind}:${key}`;
        const previous = seen.get(id);
        if (previous) problems.push(`${kind} used twice (${previous} and ${owner}): "${key}"`);
        else seen.set(id, owner);
    };

    for (const { role, prose } of resolved) {
        if (seen.get(`role:${role.id}`)) problems.push(`role id used twice: ${role.id}`);
        seen.set(`role:${role.id}`, role.id);

        for (const locale of ROLE_EXAMPLE_LOCALES) {
            const version = role.versions[locale];
            if (!version) continue;
            const owner = `${role.id} (${locale})`;
            claim(`slug/${locale}`, version.slug, owner);
            claim(`title/${locale}`, normalise(version.title), owner);
            claim(`description/${locale}`, normalise(version.description), owner);
            for (const tip of prose[locale]?.tips ?? []) claim(`tip/${locale}`, normalise(tip), owner);
        }
    }
    return problems;
}
