import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import { getBlogAuthor } from "./blog-authors";
import { validateBlogVersions, type BlogVersion } from "./blog-articles";
import { blogPostPath } from "./site";

// The real collection can't load in Vitest (it imports compiled MDX), so these
// checks read the files from disk and apply the same schema the build does.
vi.mock("./blog-source", () => ({ blogSource: { getPages: () => [] } }));

const { blogFrontmatterSchema } = await import("./blog");

const CONTENT_DIR = path.join(process.cwd(), "content", "blog");

function mdxFiles(dir = CONTENT_DIR): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return mdxFiles(full);
        return entry.name.endsWith(".mdx") ? [path.relative(CONTENT_DIR, full).split(path.sep).join("/")] : [];
    });
}

function readPost(file: string) {
    const source = fs.readFileSync(path.join(CONTENT_DIR, file), "utf8");
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (!match) throw new Error(`${file} has no frontmatter`);
    return { frontmatter: blogFrontmatterSchema.parse(parse(match[1])), body: source.slice(match[0].length) };
}

const files = mdxFiles();
const posts = files.map((file) => ({ file, ...readPost(file) }));

describe("blog content files", () => {
    it("finds the posts, including translations in locale folders", () => {
        expect(files.length).toBeGreaterThanOrEqual(4);
    });

    it.each(files)("%s sits in the folder of its language", (file) => {
        const { frontmatter } = readPost(file);
        const folder = file.includes("/") ? file.split("/")[0] : "en";
        expect(folder).toBe(frontmatter.locale);
    });

    it.each(files)("%s names a known author", (file) => {
        expect(getBlogAuthor(readPost(file).frontmatter.author)).not.toBeNull();
    });

    it("has no duplicate slugs per language and one version per language per article", () => {
        const versions: BlogVersion[] = posts.map(({ file, frontmatter }) => ({
            slug: frontmatter.slug,
            locale: frontmatter.locale,
            article: frontmatter.article ?? frontmatter.slug,
            draft: frontmatter.draft,
            date: frontmatter.date,
            path: blogPostPath(frontmatter.slug, frontmatter.locale),
            sourcePath: file,
        }));
        expect(() => validateBlogVersions(versions)).not.toThrow();
    });

    it("has the CEFR pilot article in English, German and Bosnian, each linking to its own CEFR tool", () => {
        const pilot = posts.filter(({ frontmatter }) => frontmatter.article === "cefr-language-levels");
        expect(pilot.map(({ frontmatter }) => frontmatter.locale).sort()).toEqual(["bs", "de", "en"]);
        expect(pilot.find(({ frontmatter }) => frontmatter.locale === "en")?.frontmatter.draft).toBe(false);
        for (const { frontmatter, body } of pilot) {
            const tool = frontmatter.locale === "en" ? "/tools/cefr-level" : `/${frontmatter.locale}/tools/cefr-level`;
            expect(body, frontmatter.slug).toContain(`](${tool})`);
        }
    });

    it.each(files)("%s links site pages in its own language", (file) => {
        const { frontmatter, body } = readPost(file);
        if (frontmatter.locale === "en") return;
        // Internal links in a German post should point at /de/..., never at the English page.
        const internal = [...body.matchAll(/\]\((\/[^)\s]*)\)/g)].map((match) => match[1]);
        for (const href of internal) expect(href.startsWith(`/${frontmatter.locale}/`) || href === `/${frontmatter.locale}`).toBe(true);
    });
});
