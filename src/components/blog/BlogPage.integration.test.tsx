import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BlogPost, BlogPostMeta } from "@/lib/blog";
import { getBlogAuthor } from "@/lib/blog-authors";
import { formatBlogDate } from "@/lib/blog-format";
import { translateBlog } from "@/lib/blog-i18n";
import { useI18nStore } from "@/lib/i18n";
import { RouteLocaleProvider } from "@/lib/i18n/route-locale";
import { DraftNotice } from "./DraftNotice";
import { PostHeader } from "./PostHeader";
import { BlogIndexContent } from "./BlogIndexContent";

vi.mock("next/navigation", () => ({
    usePathname: () => "/",
    useRouter: () => ({ prefetch: vi.fn() }),
    notFound: () => {
        throw new Error("NEXT_NOT_FOUND");
    },
}));

function meta(overrides: Partial<BlogPostMeta>): BlogPostMeta {
    const slug = overrides.slug ?? "cefr-language-levels-on-your-cv";
    return {
        title: "CEFR language levels on your CV",
        description: "How to state A1–C2 on a CV.",
        slug,
        date: "2026-10-09",
        tags: [],
        sponsored: false,
        adSlots: [],
        locale: "en",
        article: "cefr-language-levels",
        draft: false,
        path: `/blog/${slug}`,
        sourcePath: `${slug}.mdx`,
        authorId: "safet-imamovic",
        author: getBlogAuthor("safet-imamovic")!,
        toc: [],
        readingTimeMinutes: 5,
        ...overrides,
    };
}

const en = meta({});
const de = meta({
    locale: "de",
    slug: "sprachniveau-im-lebenslauf-angeben",
    path: "/de/blog/sprachniveau-im-lebenslauf-angeben",
    sourcePath: "de/sprachniveau-im-lebenslauf-angeben.mdx",
    title: "Sprachniveau im Lebenslauf angeben (A1–C2)",
});
const bsDraft = meta({
    locale: "bs",
    slug: "nivo-jezika-u-cv-u",
    path: "/bs/blog/nivo-jezika-u-cv-u",
    sourcePath: "bs/nivo-jezika-u-cv-u.mdx",
    draft: true,
});
const posts = [en, de, bsDraft];

vi.mock("@/lib/blog", () => ({
    getAllBlogPostMeta: async () => posts,
    getBlogPost: async (locale: string, slug: string) =>
        posts.find((post) => post.locale === locale && post.slug === slug) as BlogPost | undefined ?? null,
}));

const { blogPostMetadata } = await import("./BlogPostPage");
const { BlogIndexPage, blogIndexMetadata } = await import("./BlogIndexPage");

describe("localized blog index without published articles", () => {
    afterEach(cleanup);

    it("keeps Bosnian chrome and hides draft articles", async () => {
        render(await BlogIndexPage({ locale: "bs" }));
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(translateBlog("bs", "index.title"));
        expect(screen.getByText("Na ovom jeziku još nema objavljenih članaka.")).toBeInTheDocument();
        expect(within(screen.getByTestId("blog-empty-state")).getByRole("link", { name: "Više članaka na engleskom" })).toHaveAttribute("href", "/blog");
        expect(screen.queryByRole("link", { name: bsDraft.title })).not.toBeInTheDocument();
    });

    it("keeps empty indexes noindex and out of hreflang", async () => {
        const metadata = await blogIndexMetadata("bs");
        expect(metadata.robots).toEqual({ index: false, follow: true });
        expect(metadata.alternates).toEqual({ canonical: "/bs/blog" });
        expect((await blogIndexMetadata("de")).robots).toBeUndefined();
    });

    it("does not offer English when every English article is already translated", async () => {
        render(await BlogIndexPage({ locale: "de" }));
        expect(screen.queryByTestId("blog-more-english")).not.toBeInTheDocument();
    });

    it.each(["bs", "de", "fr", "es"] as const)("places the translated English link after local posts in %s", (locale) => {
        render(
            <RouteLocaleProvider locale={locale}>
                <BlogIndexContent posts={[meta({ locale })]} showEnglishLink />
            </RouteLocaleProvider>,
        );
        const link = screen.getByRole("link", { name: translateBlog(locale, "index.moreEnglish") });
        expect(link).toHaveAttribute("href", "/blog");
        expect(link).toHaveAttribute("hreflang", "en");
        expect(screen.getByRole("article").compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.queryByTestId("blog-empty-state")).not.toBeInTheDocument();
    });
});

describe("blog chrome language", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(cleanup);

    it("renders a German post's labels, date and author role in German", () => {
        render(
            <RouteLocaleProvider locale="de">
                <PostHeader post={de} indexHref="/de/blog" />
            </RouteLocaleProvider>,
        );

        expect(screen.getByRole("link", { name: translateBlog("de", "breadcrumb") })).toHaveAttribute("href", "/de/blog");
        expect(screen.getByText(translateBlog("de", "author"))).toBeInTheDocument();
        expect(screen.getByText("Gründer, EngineCV")).toBeInTheDocument();
        expect(screen.getByText(formatBlogDate(de.date, "de"))).toBeInTheDocument();
        expect(screen.getByText(translateBlog("de", "readingTime", { minutes: 5 }))).toBeInTheDocument();
    });

    it("keeps an English post English when the visitor stored German", () => {
        useI18nStore.setState({ locale: "de", _hydrated: true });
        render(
            <RouteLocaleProvider locale="en">
                <PostHeader post={en} indexHref="/blog" />
            </RouteLocaleProvider>,
        );

        expect(screen.getByText("Founder, EngineCV")).toBeInTheDocument();
        expect(screen.getByText(translateBlog("en", "readingTime", { minutes: 5 }))).toBeInTheDocument();
        expect(screen.queryByText(translateBlog("de", "readingTime", { minutes: 5 }))).not.toBeInTheDocument();
    });

    it("shows when a post was last updated, in the post's language", () => {
        const updated = meta({ locale: "de", slug: "x", updated: "2026-11-05" });
        render(
            <RouteLocaleProvider locale="de">
                <PostHeader post={updated} indexHref="/de/blog" />
            </RouteLocaleProvider>,
        );

        expect(screen.getByText(translateBlog("de", "updated", { date: formatBlogDate("2026-11-05", "de") }))).toBeInTheDocument();
        // The original publication date stays visible too.
        expect(screen.getByText(formatBlogDate(updated.date, "de"))).toBeInTheDocument();
    });

    it("shows no updated line when there is no update, or it is the publication day", () => {
        for (const updated of [undefined, en.date]) {
            const { unmount } = render(
                <RouteLocaleProvider locale="en">
                    <PostHeader post={meta({ updated })} indexHref="/blog" />
                </RouteLocaleProvider>,
            );
            expect(screen.queryByText(/^Updated /)).not.toBeInTheDocument();
            unmount();
        }
    });

    it("shows the draft note in the page's language", () => {
        render(<DraftNotice locale="bs" />);
        expect(screen.getByRole("note")).toHaveTextContent(translateBlog("bs", "draftNotice"));
    });
});

describe("blog post metadata", () => {
    it("lists published siblings as alternates and English as x-default", async () => {
        const metadata = await blogPostMetadata("de", de.slug);

        expect(metadata.alternates).toEqual({
            canonical: de.path,
            languages: { en: en.path, de: de.path, "x-default": en.path },
        });
        expect(metadata.openGraph).toMatchObject({ locale: "de_DE", url: de.path });
        expect(metadata.robots).toBeUndefined();
    });

    it("marks a draft noindex and gives it no alternates", async () => {
        const metadata = await blogPostMetadata("bs", bsDraft.slug);

        expect(metadata.robots).toEqual({ index: false, follow: true });
        expect(metadata.alternates).toEqual({ canonical: bsDraft.path });
    });

    it("never lists a draft among a published post's alternates", async () => {
        const metadata = await blogPostMetadata("en", en.slug);
        expect(Object.values(metadata.alternates?.languages ?? {})).not.toContain(bsDraft.path);
    });

    it("returns not-found metadata for a slug in the wrong language", async () => {
        expect(await blogPostMetadata("de", en.slug)).toEqual({ title: "Beitrag nicht gefunden" });
    });
});
