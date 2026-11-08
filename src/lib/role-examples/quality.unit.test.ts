import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { buildExampleResume } from "@/lib/onboarding/create-example";
import { resolveExampleContent } from "@/lib/onboarding/examples";
import type { Resume } from "@/lib/schema";
import { getGalleryTemplates } from "@/lib/templates/gallery";
import {
    checkRegistry,
    checkRole,
    MIN_WORDS,
    proseWordCount,
    type QualityContext,
    type RoleExampleResolved,
} from "./quality";
import { ROLE_EXAMPLES, ROLE_EXAMPLE_LOCALES, type RoleExample, type RoleExampleLocale, type RoleProse } from "./registry";

async function resolve(role: RoleExample): Promise<RoleExampleResolved> {
    const [prose, content] = await Promise.all([role.loadProse(), role.loadContent()]);
    const resumes: Partial<Record<RoleExampleLocale, Resume>> = {};
    for (const locale of ROLE_EXAMPLE_LOCALES) {
        if (!role.versions[locale]) continue;
        const { locale: contentLocale, input } = resolveExampleContent(content, locale);
        // A version must have its own content: English fallback would publish the wrong language.
        expect(contentLocale, `${role.id} (${locale}) example content language`).toBe(locale);
        resumes[locale] = buildExampleResume(input, contentLocale, role.id, 1_000);
    }
    return { role, prose, resumes };
}

// The blog collection can't load in Vitest (compiled MDX), so published article
// ids are read from the frontmatter on disk, the way blog-files.unit.test.ts does.
const BLOG_DIR = path.join(process.cwd(), "content", "blog");

function publishedArticleIds(dir = BLOG_DIR): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return publishedArticleIds(full);
        if (!entry.name.endsWith(".mdx")) return [];
        const source = fs.readFileSync(full, "utf8");
        const end = source.indexOf("---", 3);
        const data = (end > 0 ? parse(source.slice(3, end)) : {}) as { article?: string; slug?: string; draft?: boolean };
        return data.draft ? [] : [data.article ?? data.slug ?? entry.name.replace(/\.mdx$/, "")];
    });
}

const context: QualityContext = {
    templateSlugs: new Set(getGalleryTemplates().map((entry) => entry.slug)),
    publishedArticleIds: new Set(publishedArticleIds()),
};

const resolved = await Promise.all(ROLE_EXAMPLES.map(resolve));

describe("registry", () => {
    it.each(resolved.map((entry) => [entry.role.id, entry] as const))("%s passes the quality gate", (_id, entry) => {
        expect(checkRole(entry, context)).toEqual([]);
    });

    it("has no duplicated slugs, titles, descriptions or tips", () => {
        expect(checkRegistry(resolved)).toEqual([]);
    });
});

// ---- the gate itself, against a minimal passing role ----

const words = (count: number) => Array.from({ length: count }, (_, index) => `word${index}`).join(" ");

function goodProse(): RoleProse {
    return { intro: words(MIN_WORDS), tips: ["tip one a", "tip two b", "tip three c"], skills: ["a", "b", "c", "d", "e", "f"] };
}

function goodRole(): RoleExampleResolved {
    const base = resolved[0];
    return {
        role: {
            ...base.role,
            versions: { en: { ...base.role.versions.en!, status: "published" } },
        },
        prose: { en: goodProse() },
        resumes: { en: base.resumes.en },
    };
}

describe("checkRole", () => {
    it("accepts the minimal passing role", () => {
        expect(checkRole(goodRole(), context)).toEqual([]);
        expect(proseWordCount(goodProse())).toBeGreaterThanOrEqual(MIN_WORDS);
    });

    it("rejects a published version with too little text but allows it as a draft", () => {
        const thin = goodRole();
        thin.prose.en = { ...goodProse(), intro: "short" };
        expect(checkRole(thin, context).join()).toContain("words of prose");

        thin.role = { ...thin.role, versions: { en: { ...thin.role.versions.en!, status: "draft" } } };
        expect(checkRole(thin, context)).toEqual([]);
    });

    it.each([
        ["too few tips", { tips: ["one", "two"] }, "tips, expected"],
        ["too many tips", { tips: ["1", "2", "3", "4", "5", "6"] }, "tips, expected"],
        ["too few skills", { skills: ["a", "b"] }, "skills, expected"],
    ])("rejects %s", (_name, patch, message) => {
        const role = goodRole();
        role.prose.en = { ...goodProse(), ...patch };
        expect(checkRole(role, context).join()).toContain(message);
    });

    it("rejects an unknown template and a related article without a published version", () => {
        const role = goodRole();
        role.role = { ...role.role, template: "nope" as never, relatedArticle: "missing-article" };
        const problems = checkRole(role, context).join();
        expect(problems).toContain("not a gallery template");
        expect(problems).toContain("no published version");
    });

    it("rejects a bad description length and a bad slug", () => {
        const role = goodRole();
        role.role = { ...role.role, versions: { en: { ...role.role.versions.en!, slug: "Bad Slug", description: "too short" } } };
        const problems = checkRole(role, context).join();
        expect(problems).toContain("not kebab-case");
        expect(problems).toContain("description is");
    });

    it("rejects real-looking contact data", () => {
        const role = goodRole();
        const resume = structuredClone(role.resumes.en!);
        resume.basics.email = "someone@gmail.com";
        resume.basics.phone = "+49 170 1234567";
        role.resumes.en = resume;
        const problems = checkRole(role, context).join();
        expect(problems).toContain("not an @example.com address");
        expect(problems).toContain("outside the fictional range");
    });

    it("rejects a version with no example CV in its language", () => {
        const role = goodRole();
        role.resumes = {};
        expect(checkRole(role, context).join()).toContain("no example CV");
    });
});

describe("checkRegistry", () => {
    it("rejects a repeated slug, title and tip across roles", () => {
        const first = goodRole();
        const second = goodRole();
        second.role = { ...second.role, id: "other" };
        const problems = checkRegistry([first, second]).join("\n");
        expect(problems).toContain("slug/en used twice");
        expect(problems).toContain("title/en used twice");
        expect(problems).toContain("tip/en used twice");
    });
});
