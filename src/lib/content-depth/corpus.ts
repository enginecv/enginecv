import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { ROLE_EXAMPLES } from "@/lib/role-examples/registry";
import { getEnabledTools } from "@/lib/tools/registry";
import { getToolProse, toolProseParagraphs } from "@/lib/tools/prose";
import { getGalleryTemplates } from "@/lib/templates/gallery";
import { getTemplateProse, templateProseParagraphs } from "@/lib/templates/prose";
import { ABOUT_META, ABOUT_SECTIONS } from "@/lib/about/content";
import { paragraphs, stripMarkdown } from "./word-count";

/**
 * English content gathered for the floor and uniqueness tests (feature 078).
 * Loaders for content that does not exist yet return empty lists, so a test
 * fails with a readable message instead of an import error. Used by tests only.
 */

export type DocKind = "role" | "tool" | "blog" | "about" | "template" | "guide";

export interface CorpusDoc {
    id: string;
    kind: DocKind;
    /** Reader-visible prose, paragraphs separated by blank lines. */
    text: string;
}

export interface BlogDoc extends CorpusDoc {
    kind: "blog";
    file: string;
    frontMatter: Record<string, unknown>;
}

const BLOG_DIR = join(process.cwd(), "content", "blog");
const GUIDES_DIR = join(process.cwd(), "content", "guides");

export interface GuideDoc extends CorpusDoc {
    kind: "guide";
    slug: string;
    file: string;
    frontMatter: Record<string, unknown>;
    /** Reader-visible body prose only (the word-count floor measures this). */
    body: string;
    /** Raw MDX source, for structure checks such as before/after blocks. */
    source: string;
}

/** English roles. Counts intro, tips and sections; skills are chips, not prose. */
export async function loadRoleDocs(): Promise<CorpusDoc[]> {
    const docs: CorpusDoc[] = [];
    for (const role of ROLE_EXAMPLES) {
        const prose = (await role.loadProse()).en;
        if (!prose) continue;
        const parts = [
            prose.intro,
            ...prose.tips,
            ...(prose.sections ?? []).flatMap((section) => section.paragraphs),
        ];
        docs.push({ id: `role:${role.id}`, kind: "role", text: parts.join("\n\n") });
    }
    return docs;
}

/** The English posts directly under content/blog, never the bs/ and de/ subfolders. */
export function loadBlogDocs(): BlogDoc[] {
    return readdirSync(BLOG_DIR, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
        .map((entry) => {
            const source = readFileSync(join(BLOG_DIR, entry.name), "utf8");
            const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            const frontMatter = (match ? parseYaml(match[1]) : {}) as Record<string, unknown>;
            return {
                id: `blog:${entry.name.replace(/\.mdx$/, "")}`,
                kind: "blog" as const,
                file: entry.name,
                frontMatter,
                text: stripMarkdown(source),
            };
        });
}

/** Section guides (feature 079): drafts included, so tests can pick published ones from the front matter. */
export function loadGuideDocs(): GuideDoc[] {
    return readdirSync(GUIDES_DIR, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
        .map((entry) => {
            const source = readFileSync(join(GUIDES_DIR, entry.name), "utf8");
            const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
            const frontMatter = (match ? parseYaml(match[1]) : {}) as Record<string, unknown>;
            const body = stripMarkdown(source);
            const faq = Array.isArray(frontMatter.faq) ? (frontMatter.faq as Array<{ q?: string; a?: string }>) : [];
            const faqText = faq.flatMap((item) => [item.q ?? "", item.a ?? ""]).filter(Boolean).join("\n\n");
            const slug = String(frontMatter.slug ?? entry.name.replace(/\.mdx$/, ""));
            return {
                id: `guide:${slug}`,
                kind: "guide" as const,
                slug,
                file: entry.name,
                frontMatter,
                body,
                source,
                text: faqText ? `${body}\n\n${faqText}` : body,
            };
        });
}

/** Tool long-form prose: the deep-dive text shown under each English tool page. */
export async function loadToolDocs(): Promise<CorpusDoc[]> {
    return getEnabledTools().flatMap((tool) => {
        const prose = getToolProse(tool.slug);
        return prose ? [{ id: `tool:${tool.slug}`, kind: "tool" as const, text: toolProseParagraphs(prose).join("\n\n") }] : [];
    });
}

/** Template long-form prose: the deep-dive text shown under each English template page. */
export async function loadTemplateDocs(): Promise<CorpusDoc[]> {
    return getGalleryTemplates().flatMap(({ slug }) => {
        const prose = getTemplateProse(slug);
        return prose ? [{ id: `template:${slug}`, kind: "template" as const, text: templateProseParagraphs(prose).join("\n\n") }] : [];
    });
}

/** The About page body: intro plus every section. */
export async function loadAboutDocs(): Promise<CorpusDoc[]> {
    const parts = [ABOUT_META.intro, ...ABOUT_SECTIONS.flatMap((section) => [section.heading, ...section.paragraphs])];
    return [{ id: "about", kind: "about", text: parts.join("\n\n") }];
}

export async function loadAllDocs(): Promise<CorpusDoc[]> {
    const [roles, tools, templates, about] = await Promise.all([loadRoleDocs(), loadToolDocs(), loadTemplateDocs(), loadAboutDocs()]);
    return [...roles, ...loadBlogDocs(), ...loadGuideDocs(), ...tools, ...templates, ...about];
}

/** Every paragraph of every doc, tagged with its document id, for the uniqueness check. */
export async function loadParagraphs(): Promise<{ docId: string; text: string }[]> {
    const docs = await loadAllDocs();
    return docs.flatMap((doc) => paragraphs(doc.text).map((text) => ({ docId: doc.id, text })));
}
