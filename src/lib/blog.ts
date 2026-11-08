import type { MDXContent } from "mdx/types";
import { cache } from "react";
import { z } from "zod";
import { getBlogAuthor, type BlogAuthor, type BlogAuthorId } from "./blog-authors";
import { validateBlogVersions } from "./blog-articles";
import { extractBlogTocFromMarkdown } from "./blog-headings";
import { blogSource } from "./blog-source";
import type { Locale } from "./i18n/locales";
import { blogPostPath } from "./site";

const DEFAULT_AD_SLOTS = ["after-first-paragraph", "mid-article", "end-of-article"] as const;
const OPTIONAL_AD_SLOTS = ["sidebar-square"] as const;
const ALL_AD_SLOTS = [...DEFAULT_AD_SLOTS, ...OPTIONAL_AD_SLOTS] as const;
const BLOG_LOCALES = ["en", "de", "bs", "fr", "es"] as const satisfies readonly Locale[];

const adSlotSchema = z.enum(ALL_AD_SLOTS);
const slugSchema = z.string().regex(/^[a-z0-9-]+$/);

export const blogFrontmatterSchema = z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    slug: slugSchema,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** Last substantive edit, if any; structured data falls back to `date`. */
    updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    author: z.string().min(1),
    tags: z.array(z.string()).default([]),
    sponsored: z.boolean().default(false),
    adSlots: z.array(adSlotSchema).default([...DEFAULT_AD_SLOTS]),
    /** Language of this version. English posts sit at the collection root, others in `<locale>/`. */
    locale: z.enum(BLOG_LOCALES).default("en"),
    /** Shared by every language version of one article; defaults to the slug. */
    article: slugSchema.optional(),
    /** Drafts render at their address for reviewers but are noindex and unlisted. */
    draft: z.boolean().default(false),
});

export type BlogAdSlot = z.infer<typeof adSlotSchema>;
export type BlogFrontmatter = z.infer<typeof blogFrontmatterSchema>;

export interface BlogTocItem {
    title: string;
    url: string;
    depth: 2 | 3;
}

export interface BlogPostMeta extends Omit<BlogFrontmatter, "author" | "article"> {
    article: string;
    /** `/blog/<slug>` for English, `/<locale>/blog/<slug>` otherwise. */
    path: string;
    /** Source file relative to `content/blog`, for error messages and folder checks. */
    sourcePath: string;
    authorId: BlogAuthorId;
    author: BlogAuthor;
    toc: BlogTocItem[];
    readingTimeMinutes: number;
}

export interface BlogPost extends BlogPostMeta {
    body: MDXContent;
    content: string;
}

type BlogSourcePage = ReturnType<typeof blogSource.getPages>[number];

function stripShortcodes(content: string) {
    return content
        .replace(/<InlineCTA\s*\/>/gi, " ")
        .replace(/<CTA(?:\s+variant=["']inline["'])?\s*\/>/gi, " ")
        .replace(/<AdSlot(?:\s+(?:slot|position)=["'][^"']+["'])?\s*\/>/gi, " ");
}

export function estimateReadingTimeMinutes(content: string) {
    const cleaned = stripShortcodes(content)
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`[^`]*`/g, " ")
        .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
        .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
        .replace(/[#>*_\-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!cleaned) {
        return 1;
    }

    const words = cleaned.split(" ").filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
}

function parseFrontmatterDate(date: string) {
    const [year, month, day] = date.split("-").map((segment) => Number(segment));
    return new Date(Date.UTC(year, month - 1, day));
}

function comparePostsByDateDescending(left: BlogPostMeta, right: BlogPostMeta) {
    return parseFrontmatterDate(right.date).getTime() - parseFrontmatterDate(left.date).getTime();
}

function normalizeBlogToc(items: Array<{ title: unknown; url: string; depth: number }>): BlogTocItem[] {
    return items
        .filter((item): item is { title: string; url: string; depth: 2 | 3 } => {
            return (item.depth === 2 || item.depth === 3) && typeof item.title === "string";
        })
        .map((item) => ({
            title: item.title,
            url: item.url,
            depth: item.depth,
        }));
}

async function readBlogPostFromSource(page: BlogSourcePage): Promise<BlogPost> {
    // The processed markdown is bundled with the post, so this also works on
    // the Worker, which has no file system to read the .mdx file from.
    const content = (await page.data.getText("processed")).trim();
    const author = getBlogAuthor(page.data.author);
    const normalizedToc = normalizeBlogToc(page.data.toc);

    if (!author) {
        throw new Error(`Unknown blog author "${page.data.author}" in ${page.data.info.path}`);
    }

    const locale = page.data.locale ?? "en";

    return {
        title: page.data.title,
        description: page.data.description,
        slug: page.data.slug,
        date: page.data.date,
        updated: page.data.updated,
        tags: page.data.tags,
        sponsored: page.data.sponsored,
        adSlots: page.data.adSlots,
        locale,
        article: page.data.article ?? page.data.slug,
        draft: page.data.draft ?? false,
        path: blogPostPath(page.data.slug, locale),
        sourcePath: page.data.info.path.replace(/\\/g, "/"),
        authorId: author.id as BlogAuthorId,
        author,
        toc: normalizedToc.length > 0 ? normalizedToc : extractBlogTocFromMarkdown(content),
        body: page.data.body,
        content,
        readingTimeMinutes: estimateReadingTimeMinutes(content),
    };
}

function toMeta(post: BlogPost): BlogPostMeta {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { body, content, ...postMeta } = post;
    return postMeta;
}

/** Every version in every language, drafts included, newest first. Throws on duplicate slugs. */
const getAllBlogPosts = cache(async (): Promise<BlogPost[]> => {
    const posts = await Promise.all(blogSource.getPages().map((page) => readBlogPostFromSource(page)));
    validateBlogVersions(posts);
    return posts.sort(comparePostsByDateDescending);
});

/** Every version in every language, drafts included, newest first. */
export async function getAllBlogPostMeta(): Promise<BlogPostMeta[]> {
    return (await getAllBlogPosts()).map(toMeta);
}

/** Every version in one language, drafts included, newest first. */
export async function getBlogPosts(locale: Locale): Promise<BlogPostMeta[]> {
    return (await getAllBlogPostMeta()).filter((post) => post.locale === locale);
}

export async function getBlogPost(locale: Locale, slug: string): Promise<BlogPost | null> {
    return (await getAllBlogPosts()).find((post) => post.locale === locale && post.slug === slug) ?? null;
}

/** `(lang, slug)` pairs for the `[lang]/blog/[slug]` route: every non-English version, drafts included. */
export async function getBlogStaticParams(): Promise<Array<{ lang: Locale; slug: string }>> {
    return (await getAllBlogPostMeta())
        .filter((post) => post.locale !== "en")
        .map((post) => ({ lang: post.locale, slug: post.slug }));
}
