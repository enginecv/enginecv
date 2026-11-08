import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// Vitest can't import the compiled MDX collection, so the source is mocked
// with the real files' frontmatter-free text standing in for the processed
// markdown fumadocs exports.
vi.mock("./blog-source", () => {
    const contentDirectory = path.join(process.cwd(), "content", "blog");
    const body = (file: string) => fs.readFileSync(path.join(contentDirectory, file), "utf8")
        .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

    const page = (file: string, data: Record<string, unknown>) => ({
        data: {
            body: () => null,
            toc: [],
            info: { fullPath: path.join(contentDirectory, file), path: file },
            getText: async (type: string) => {
                if (type !== "processed") throw new Error("only processed text exists on the Worker");
                return body(file);
            },
            ...data,
        },
    });

    return {
        blogSource: {
            getPages: () => [
                page("how-to-write-a-resume-in-2026.mdx", {
                    title: "How to Write a Resume in 2026",
                    description: "A practical guide to writing a modern resume that stays readable, ATS-friendly, and grounded in real experience.",
                    slug: "how-to-write-a-resume-in-2026",
                    date: "2026-01-18",
                    author: "safet-imamovic",
                    tags: ["resume writing", "ATS", "job search"],
                    sponsored: false,
                    adSlots: ["after-first-paragraph", "mid-article", "end-of-article", "sidebar-square"],
                    toc: [
                        { title: "Start with the headline, not the objective", url: "#start-with-the-headline-not-the-objective", depth: 2 },
                    ],
                }),
                page("common-resume-mistakes.mdx", {
                    title: "Common Resume Mistakes",
                    description: "The fastest way to improve a resume is usually to remove the mistakes that make it vague, inflated, or harder to scan.",
                    slug: "common-resume-mistakes",
                    date: "2026-03-05",
                    author: "emir-kovacevic",
                    tags: ["resume mistakes", "editing", "job search"],
                    sponsored: false,
                    adSlots: ["after-first-paragraph", "mid-article", "end-of-article", "sidebar-square"],
                    toc: [
                        { title: "Mistake 1: Writing bullets that say nothing", url: "#mistake-1-writing-bullets-that-say-nothing", depth: 2 },
                    ],
                }),
                page("best-cv-formats-for-ats-systems.mdx", {
                    title: "Best CV Formats for ATS Systems",
                    description: "The best CV format for ATS systems is usually the simplest one: clear sections, predictable order, and no layout tricks that hide your content.",
                    slug: "best-cv-formats-for-ats-systems",
                    date: "2026-02-12",
                    author: "mila-hadzic",
                    tags: ["cv format", "ATS", "templates"],
                    sponsored: true,
                    adSlots: ["after-first-paragraph", "mid-article", "end-of-article", "sidebar-square"],
                    toc: [
                        { title: "The safest default format", url: "#the-safest-default-format", depth: 2 },
                    ],
                }),
            ],
        },
    };
});

import { estimateReadingTimeMinutes, getAllBlogPostMeta, getBlogPost, getBlogPosts, getBlogStaticParams } from "./blog";

describe("blog content loader", () => {
    it("loads and sorts blog posts by date descending", async () => {
        const posts = await getAllBlogPostMeta();

        expect(posts.map((post) => post.slug)).toEqual([
            "common-resume-mistakes",
            "best-cv-formats-for-ats-systems",
            "how-to-write-a-resume-in-2026",
        ]);
    });

    it("returns parsed frontmatter and content for a post", async () => {
        const post = await getBlogPost("en", "best-cv-formats-for-ats-systems");

        expect(post).not.toBeNull();
        expect(post?.sponsored).toBe(true);
        expect(post?.author.name).toBe("Mila Hadzic");
        expect(post?.adSlots).toContain("end-of-article");
        expect(post?.adSlots).toContain("sidebar-square");
        expect(post?.toc.map((item) => item.title)).toContain("The safest default format");
        expect(post?.content).toContain("<InlineCTA />");
    });

    it("defaults English posts to their own article id, an English path and published", async () => {
        const post = await getBlogPost("en", "common-resume-mistakes");

        expect(post).toMatchObject({
            locale: "en",
            article: "common-resume-mistakes",
            draft: false,
            path: "/blog/common-resume-mistakes",
            sourcePath: "common-resume-mistakes.mdx",
        });
    });

    it("counts reading time from the post's own text, not a shortened copy", async () => {
        const post = await getBlogPost("en", "how-to-write-a-resume-in-2026");
        const words = post!.content.split(/\s+/).filter(Boolean).length;

        expect(words).toBeGreaterThan(400);
        expect(post?.readingTimeMinutes).toBe(estimateReadingTimeMinutes(post!.content));
        expect(post?.readingTimeMinutes).toBeGreaterThanOrEqual(2);
    });

    it("queries one language and lists only non-English versions as localized routes", async () => {
        expect(await getBlogPosts("en")).toHaveLength(3);
        expect(await getBlogPosts("de")).toEqual([]);
        expect(await getBlogPost("de", "common-resume-mistakes")).toBeNull();
        expect(await getBlogStaticParams()).toEqual([]);
    });
});
