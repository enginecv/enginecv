import { describe, expect, it } from "vitest";
import { getBlogAuthor } from "@/lib/blog-authors";
import { en } from "@/lib/i18n/en";
import { getToolProse, toolProseParagraphs } from "@/lib/tools/prose";
import { getEnabledTools } from "@/lib/tools/registry";
import { ABOUT_SECTIONS } from "@/lib/about/content";
import { loadAboutDocs, loadBlogDocs, loadParagraphs, loadRoleDocs } from "./corpus";
import { countWords, findDuplicates } from "./word-count";

/**
 * Quality floors from specs/078-adsense-content-depth/contracts/content-rules.md.
 * These measure length and reuse only. Whether the text is specific and true is
 * the owner's review, not a test.
 */

const ROLE_MIN = 600;
const ROLE_MAX = 900;
const BLOG_MIN = 1200;
const EXPECTED_ROLES = 8;
const EXPECTED_POSTS = 5;
const TOOL_PAGE_MIN = 700;

/** Paragraph similarity above this counts as reuse. See the note in the uniqueness group. */
const DUPLICATE_THRESHOLD = 0.6;

describe("role examples", () => {
    it("has every English role", async () => {
        expect(await loadRoleDocs()).toHaveLength(EXPECTED_ROLES);
    });

    it(`keeps each role's prose between ${ROLE_MIN} and ${ROLE_MAX} words`, async () => {
        const outside = (await loadRoleDocs())
            .map((doc) => ({ id: doc.id, words: countWords(doc.text) }))
            .filter(({ words }) => words < ROLE_MIN || words > ROLE_MAX);
        expect(outside, `outside ${ROLE_MIN}-${ROLE_MAX} words`).toEqual([]);
    });
});

describe("blog posts", () => {
    const posts = loadBlogDocs();

    it("has every English post and ignores the bs/ and de/ folders", () => {
        expect(posts).toHaveLength(EXPECTED_POSTS);
        expect(posts.every((post) => !post.file.includes("/") && !post.file.includes("\\"))).toBe(true);
    });

    it(`has at least ${BLOG_MIN} words in each post`, () => {
        const short = posts
            .map((post) => ({ id: post.id, words: countWords(post.text) }))
            .filter(({ words }) => words < BLOG_MIN);
        expect(short, `under ${BLOG_MIN} words`).toEqual([]);
    });

    it("names an author that exists in the author registry", () => {
        const unknown = posts.filter((post) => !getBlogAuthor(String(post.frontMatter.author ?? "")));
        expect(unknown.map((post) => post.id)).toEqual([]);
    });

    it("has a published date and an updated date that is not earlier", () => {
        const bad = posts.filter((post) => {
            const date = String(post.frontMatter.date ?? "");
            const updated = String(post.frontMatter.updated ?? "");
            return !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(updated) || updated < date;
        });
        expect(bad.map((post) => post.id)).toEqual([]);
    });
});

describe("uniqueness", () => {
    // Containment of 4-word shingles. 0.6 means a paragraph shares most of its
    // wording with another. Tune against the real corpus and record why here.
    it("shares no paragraph between different documents", async () => {
        const pairs = findDuplicates(await loadParagraphs(), DUPLICATE_THRESHOLD);
        const report = pairs.map((pair) => `${pair.a.docId} ~ ${pair.b.docId} (${pair.score.toFixed(2)}): ${pair.a.text.slice(0, 70)}`);
        expect(report).toEqual([]);
    });
});
describe("tool pages", () => {
    const tools = getEnabledTools();

    /** Words a visitor reads on the English page: translated copy plus the deep-dive. */
    function pageWords(slug: string, prefix: string, stepCount: number, faqCount: number) {
        const keys = [
            `${prefix}.title`,
            `${prefix}.intro`,
            `${prefix}.privacy`,
            ...Array.from({ length: stepCount }, (_, i) => `${prefix}.steps.${i + 1}`),
            ...Array.from({ length: faqCount }, (_, i) => `${prefix}.faq.q${i + 1}`),
            ...Array.from({ length: faqCount }, (_, i) => `${prefix}.faq.a${i + 1}`),
        ];
        const translated = keys.reduce((sum, key) => sum + countWords(en[key] ?? ""), 0);
        const prose = getToolProse(slug);
        const deepDive = prose ? toolProseParagraphs(prose).reduce((sum, text) => sum + countWords(text), 0) : 0;
        return translated + deepDive;
    }

    it("has long-form prose for every enabled tool", () => {
        expect(tools.filter((tool) => !getToolProse(tool.slug)).map((tool) => tool.slug)).toEqual([]);
    });

    it("gives each tool an overview, at least two formats, a privacy note and limits", () => {
        const incomplete = tools.filter((tool) => {
            const prose = getToolProse(tool.slug);
            return !prose || prose.overview.length === 0 || prose.formats.length < 2 || prose.privacy.length === 0 || prose.limits.length === 0;
        });
        expect(incomplete.map((tool) => tool.slug)).toEqual([]);
    });

    it(`has at least ${TOOL_PAGE_MIN} words on each English tool page`, () => {
        const short = tools
            .map((tool) => ({ slug: tool.slug, words: pageWords(tool.slug, tool.keyPrefix, tool.stepCount, tool.faq.length) }))
            .filter(({ words }) => words < TOOL_PAGE_MIN);
        expect(short, `under ${TOOL_PAGE_MIN} words`).toEqual([]);
    });

    it("keeps five to six FAQ entries on every tool", () => {
        const off = tools.filter((tool) => tool.faq.length < 5 || tool.faq.length > 6);
        expect(off.map((tool) => tool.slug)).toEqual([]);
    });

    it("has a translated step list of at least three steps", () => {
        expect(tools.filter((tool) => tool.stepCount < 3).map((tool) => tool.slug)).toEqual([]);
    });
});

describe("about page", () => {
    it("has at least 400 words", async () => {
        const [doc] = await loadAboutDocs();
        expect(countWords(doc.text)).toBeGreaterThanOrEqual(400);
    });

    it("covers who, why, privacy and contact, with no unresolved owner placeholders", () => {
        expect(ABOUT_SECTIONS.map((section) => section.id)).toEqual(["who", "why", "privacy", "contact"]);
        const visible = ABOUT_SECTIONS.flatMap((section) => [section.heading, ...section.paragraphs]).join(" ");
        expect(visible).not.toMatch(/TODO|example\.com/i);
    });
});
