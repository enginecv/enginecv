import type { MDXContent } from "mdx/types";
import { cache } from "react";
import { loader } from "fumadocs-core/source";
import { toFumadocsSource } from "fumadocs-mdx/runtime/server";
import { guides } from "collections/server";
import { estimateReadingTimeMinutes, type BlogAdSlot, type BlogTocItem } from "@/lib/blog";
import { getBlogAuthor, type BlogAuthor } from "@/lib/blog-authors";
import { extractBlogTocFromMarkdown } from "@/lib/blog-headings";
import { guidePath } from "@/lib/site";
import { getGuideEntry } from "./registry";

const guidesSource = loader(toFumadocsSource(guides, []), { baseUrl: "/guides" });

export interface GuideFaqItem {
    q: string;
    a: string;
}

export interface GuideMeta {
    title: string;
    description: string;
    slug: string;
    date: string;
    updated?: string;
    tags: string[];
    adSlots: BlogAdSlot[];
    faq: GuideFaqItem[];
    draft: boolean;
    sponsored: false;
    /** `/guides/<slug>` */
    path: string;
    sourcePath: string;
    author: BlogAuthor;
    toc: BlogTocItem[];
    readingTimeMinutes: number;
    order: number;
}

export interface Guide extends GuideMeta {
    body: MDXContent;
    content: string;
}

type GuideSourcePage = ReturnType<typeof guidesSource.getPages>[number];

async function readGuide(page: GuideSourcePage): Promise<Guide> {
    const content = (await page.data.getText("processed")).trim();
    const author = getBlogAuthor(page.data.author);
    if (!author) throw new Error(`Unknown author "${page.data.author}" in ${page.data.info.path}`);
    const entry = getGuideEntry(page.data.slug);
    if (!entry) throw new Error(`Guide "${page.data.slug}" is not in src/lib/guides/registry.ts`);

    const toc = page.data.toc
        .filter((item): item is { title: string; url: string; depth: 2 | 3 } => (item.depth === 2 || item.depth === 3) && typeof item.title === "string")
        .map((item) => ({ title: item.title, url: item.url, depth: item.depth }));

    return {
        title: page.data.title,
        description: page.data.description,
        slug: page.data.slug,
        date: page.data.date,
        updated: page.data.updated,
        tags: page.data.tags,
        adSlots: page.data.adSlots,
        faq: page.data.faq,
        draft: page.data.draft,
        sponsored: false,
        path: guidePath(page.data.slug),
        sourcePath: page.data.info.path.replace(/\\/g, "/"),
        author,
        toc: toc.length > 0 ? toc : extractBlogTocFromMarkdown(content),
        body: page.data.body,
        content,
        readingTimeMinutes: estimateReadingTimeMinutes(content),
        order: entry.order,
    };
}

const getAllGuides = cache(async (): Promise<Guide[]> => {
    const all = await Promise.all(guidesSource.getPages().map(readGuide));
    return all.sort((a, b) => a.order - b.order);
});

function toMeta(guide: Guide): GuideMeta {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { body, content, ...meta } = guide;
    return meta;
}

/** Every guide, drafts included, in hub order. */
export async function getAllGuideMeta(): Promise<GuideMeta[]> {
    return (await getAllGuides()).map(toMeta);
}

/** Published guides only, in hub order. */
export async function getPublishedGuideMeta(): Promise<GuideMeta[]> {
    return (await getAllGuideMeta()).filter((guide) => !guide.draft);
}

export async function getGuide(slug: string): Promise<Guide | null> {
    return (await getAllGuides()).find((guide) => guide.slug === slug) ?? null;
}
