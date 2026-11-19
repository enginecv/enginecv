import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BlogPostMeta } from "@/lib/blog";
import { getBlogAuthor } from "@/lib/blog-authors";
import { translate } from "@/lib/i18n/translate";

vi.mock("next/navigation", () => ({
    usePathname: () => "/",
    useRouter: () => ({ prefetch: vi.fn(), push: vi.fn() }),
}));

function post(overrides: Partial<BlogPostMeta> & { slug: string }): BlogPostMeta {
    return {
        title: overrides.slug,
        description: `About ${overrides.slug}`,
        date: "2026-11-14",
        tags: [],
        sponsored: false,
        adSlots: [],
        locale: "en",
        article: overrides.slug,
        draft: false,
        path: `/blog/${overrides.slug}`,
        sourcePath: `${overrides.slug}.mdx`,
        authorId: "safet-imamovic",
        author: getBlogAuthor("safet-imamovic")!,
        toc: [],
        readingTimeMinutes: 5,
        ...overrides,
    };
}

let posts: BlogPostMeta[] = [];
vi.mock("@/lib/blog", () => ({ getAllBlogPostMeta: async () => posts }));

const { PopularGuidesSection, POPULAR_GUIDE_ARTICLES } = await import("./PopularGuidesSection");

describe("PopularGuidesSection", () => {
    afterEach(() => {
        cleanup();
        posts = [];
    });

    it("links each published popular guide in order, with the blog index after them", async () => {
        posts = [
            post({ slug: "common-resume-mistakes" }),
            post({ slug: "cv-vs-resume" }),
            post({ slug: "resume-with-no-experience" }),
            post({ slug: "why-i-built-enginecv" }),
        ];
        render(await PopularGuidesSection({ locale: "en" }));

        const section = screen.getByTestId("landing-popular-guides");
        const hrefs = within(section).getAllByRole("link").map((link) => link.getAttribute("href"));
        expect(hrefs).toEqual([...POPULAR_GUIDE_ARTICLES.map((article) => `/blog/${article}`), "/blog"]);
        expect(within(section).getByRole("heading", { level: 2 })).toHaveTextContent(translate("en", "landing.popularGuides.title"));
    });

    it("leaves out drafts and guides that do not exist", async () => {
        posts = [post({ slug: "cv-vs-resume" }), post({ slug: "common-resume-mistakes", draft: true })];
        render(await PopularGuidesSection({ locale: "en" }));

        const hrefs = within(screen.getByTestId("landing-popular-guides")).getAllByRole("link").map((link) => link.getAttribute("href"));
        expect(hrefs).toEqual(["/blog/cv-vs-resume", "/blog"]);
    });

    it("renders nothing when no guide is published", async () => {
        posts = [post({ slug: "why-i-built-enginecv" })];
        const { container } = render(await PopularGuidesSection({ locale: "en" }));
        expect(container).toBeEmptyDOMElement();
    });

    it("falls back to the English guide and marks its language on another locale", async () => {
        posts = [post({ slug: "cv-vs-resume" })];
        render(await PopularGuidesSection({ locale: "de" }));

        const section = screen.getByTestId("landing-popular-guides");
        expect(within(section).getByRole("heading", { level: 2 })).toHaveTextContent(translate("de", "landing.popularGuides.title"));
        expect(within(section).getByRole("link", { name: /cv-vs-resume/ })).toHaveAttribute("lang", "en");
    });
});
