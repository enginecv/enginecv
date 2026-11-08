import { describe, expect, it } from "vitest";
import {
    articleAlternates,
    articleVersions,
    blogIndexAlternates,
    blogIndexPosts,
    getBlogIndexLocales,
    groupArticles,
    indexLanguageLinks,
    postLanguageLinks,
    shouldOfferEnglishPosts,
    validateBlogVersions,
    type BlogVersion,
} from "./blog-articles";
import { blogPostPath } from "./site";

function version(overrides: Partial<BlogVersion> & Pick<BlogVersion, "slug">): BlogVersion {
    const locale = overrides.locale ?? "en";
    return {
        locale,
        article: overrides.slug,
        draft: false,
        date: "2026-10-01",
        path: blogPostPath(overrides.slug, locale),
        sourcePath: locale === "en" ? `${overrides.slug}.mdx` : `${locale}/${overrides.slug}.mdx`,
        ...overrides,
    };
}

const en = version({ slug: "cefr-language-levels-on-your-cv", article: "cefr", date: "2026-10-09" });
const de = version({ slug: "sprachniveau-im-lebenslauf-angeben", locale: "de", article: "cefr", date: "2026-10-10" });
const bsDraft = version({ slug: "nivo-jezika-u-cv-u", locale: "bs", article: "cefr", draft: true, date: "2026-10-11" });
const enOnly = version({ slug: "common-resume-mistakes", date: "2026-03-05" });
const all = [en, de, bsDraft, enOnly];

describe("validateBlogVersions", () => {
    it("accepts the same slug in two languages", () => {
        expect(() => validateBlogVersions([
            version({ slug: "enginecv", article: "a" }),
            version({ slug: "enginecv", locale: "de", article: "a" }),
        ])).not.toThrow();
    });

    it("rejects one slug used twice in one language, naming both files", () => {
        expect(() => validateBlogVersions([
            version({ slug: "same", article: "a" }),
            version({ slug: "same", article: "b", sourcePath: "other.mdx" }),
        ])).toThrow(/"same" is used twice in "en": same\.mdx and other\.mdx/);
    });

    it("rejects two versions of one article in one language", () => {
        expect(() => validateBlogVersions([
            version({ slug: "one", locale: "de", article: "a" }),
            version({ slug: "two", locale: "de", article: "a" }),
        ])).toThrow(/article "a" has two "de" versions/);
    });
});

describe("articles", () => {
    it("groups versions by article id", () => {
        const articles = groupArticles(all);
        expect(articles.map(({ id, versions }) => [id, versions.length])).toEqual([["cefr", 3], ["common-resume-mistakes", 1]]);
        expect(articleVersions(de, all)).toEqual([en, de, bsDraft]);
    });

    it("lists published versions as alternates, English as x-default, never drafts", () => {
        expect(articleAlternates([en, de, bsDraft])).toEqual({
            en: "/blog/cefr-language-levels-on-your-cv",
            de: "/de/blog/sprachniveau-im-lebenslauf-angeben",
            "x-default": "/blog/cefr-language-levels-on-your-cv",
        });
    });

    it("gives a lone published version no alternates", () => {
        expect(articleAlternates([enOnly])).toEqual({});
        expect(articleAlternates([de, bsDraft])).toEqual({});
    });

    it("uses the earliest published version as x-default when there is no English one", () => {
        const bs = { ...bsDraft, draft: false };
        expect(articleAlternates([de, bs])["x-default"]).toBe(de.path);
        expect(articleAlternates([{ ...de, date: "2026-12-01" }, bs])["x-default"]).toBe(bs.path);
    });
});

describe("blog indexes", () => {
    it("lists only published versions of one language, newest first", () => {
        expect(blogIndexPosts(all, "en").map(({ slug }) => slug)).toEqual([en.slug, enOnly.slug]);
        expect(blogIndexPosts(all, "de")).toEqual([de]);
        expect(blogIndexPosts(all, "bs")).toEqual([]);
    });

    it("indexes only languages with a published post for SEO", () => {
        expect(getBlogIndexLocales(all)).toEqual(["en", "de"]);
        expect(getBlogIndexLocales([bsDraft])).toEqual([]);
    });

    it("cross-links only published indexes for search engines", () => {
        expect(blogIndexAlternates(["en", "de"])).toEqual({ en: "/blog", de: "/de/blog", "x-default": "/blog" });
        expect(blogIndexAlternates(["en"])).toEqual({});
    });
});

describe("language switcher targets", () => {
    it("keeps the reader on the same article, else that language's blog index", () => {
        expect(postLanguageLinks(de, all)).toEqual({
            en: en.path,
            de: de.path,
            bs: "/bs/blog",
            fr: "/fr/blog",
            es: "/es/blog",
        });
        expect(postLanguageLinks(enOnly, all)).toMatchObject({ en: enOnly.path, de: "/de/blog", bs: "/bs/blog" });
    });

    it("never targets a draft, but a draft itself links to the published siblings", () => {
        expect(Object.values(postLanguageLinks(en, all))).not.toContain(bsDraft.path);
        expect(postLanguageLinks(bsDraft, all)).toMatchObject({ bs: bsDraft.path, en: en.path, de: de.path });
    });

    it("links to the blog index in each language even before publication", () => {
        expect(indexLanguageLinks()).toEqual({ en: "/blog", de: "/de/blog", bs: "/bs/blog", fr: "/fr/blog", es: "/es/blog" });
    });
});

describe("English discovery link", () => {
    it("offers English on an empty localized index", () => {
        expect(shouldOfferEnglishPosts(all, "bs")).toBe(true);
    });

    it("offers English below three published local posts when an article is missing", () => {
        const secondLocal = version({ slug: "local-only", locale: "de" });
        expect(shouldOfferEnglishPosts(all, "de")).toBe(true);
        expect(shouldOfferEnglishPosts([...all, secondLocal], "de")).toBe(true);
    });

    it("hides the link once three local posts are published", () => {
        expect(shouldOfferEnglishPosts([
            ...all,
            version({ slug: "local-two", locale: "de" }),
            version({ slug: "local-three", locale: "de" }),
        ], "de")).toBe(false);
    });

    it("compares article identities, even when both languages have the same count", () => {
        expect(shouldOfferEnglishPosts([
            en, enOnly, de, version({ slug: "local-only", locale: "de" }),
        ], "de")).toBe(true);
    });

    it("does not offer English when all its articles already have local versions", () => {
        expect(shouldOfferEnglishPosts([en, de], "de")).toBe(false);
    });

    it("does not count English drafts as additional articles", () => {
        expect(shouldOfferEnglishPosts([en, de, { ...enOnly, draft: true }], "de")).toBe(false);
    });

    it("does not treat a local draft as a published translation", () => {
        expect(shouldOfferEnglishPosts([en, bsDraft], "bs")).toBe(true);
    });

    it("hides the link on English and when no English posts are published", () => {
        expect(shouldOfferEnglishPosts(all, "en")).toBe(false);
        expect(shouldOfferEnglishPosts([de, bsDraft], "bs")).toBe(false);
    });
});
