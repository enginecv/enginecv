import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BlogPostMeta } from "@/lib/blog";
import { getBlogAuthor } from "@/lib/blog-authors";
import { translate } from "@/lib/i18n/translate";

vi.mock("next/navigation", () => ({
    usePathname: () => "/",
    useRouter: () => ({ prefetch: vi.fn(), push: vi.fn() }),
    notFound: () => {
        throw new Error("NEXT_NOT_FOUND");
    },
}));

// The page chrome (navbar, footer) is covered elsewhere; the live preview needs the browser.
vi.mock("@/components/templates/gallery/GalleryPage", () => ({
    GalleryPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("./ExamplePreview", () => ({
    ExamplePreview: () => <div data-testid="preview-stub" />,
}));

function post(overrides: Partial<BlogPostMeta>): BlogPostMeta {
    const slug = overrides.slug ?? "cefr-language-levels-on-your-cv";
    return {
        title: "How to List Language Levels on Your CV (A1–C2)",
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

const posts = [
    post({}),
    post({ slug: "best-cv-formats-for-ats-systems", article: "best-cv-formats-for-ats-systems", title: "Best CV Formats for ATS Systems" }),
];

vi.mock("@/lib/blog", () => ({ getAllBlogPostMeta: async () => posts }));

const { RoleExamplePage, roleExampleMetadata } = await import("./RoleExamplePage");

describe("published English example", () => {
    afterEach(cleanup);

    it("shows the title, tips, skills, related links and the CV text in the HTML", async () => {
        render(await RoleExamplePage({ locale: "en", slug: "nurse" }));

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Nurse CV Example");
        expect(within(screen.getByTestId("role-example-tips")).getAllByRole("listitem")).toHaveLength(5);
        expect(within(screen.getByTestId("role-example-skills")).getAllByRole("listitem").length).toBeGreaterThanOrEqual(6);
        expect(screen.getByTestId("preview-stub")).toBeInTheDocument();

        const text = screen.getByTestId("role-example-text");
        expect(text).toHaveTextContent("Jane Doe");
        expect(text).toHaveTextContent("Intensive Care Unit");
        // The page owns the only h1; the CV's own headings sit below the page's h2s.
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);

        expect(screen.getByRole("link", { name: /Template used/ })).toHaveAttribute("href", "/cv-templates/lebenslauf");
        expect(screen.getByRole("link", { name: /Read next/ })).toHaveAttribute("href", "/blog/cefr-language-levels-on-your-cv");
        expect(screen.queryByTestId("role-example-draft-notice")).not.toBeInTheDocument();
    });

    it("leaves no ad slot and no gap while ads are off", async () => {
        render(await RoleExamplePage({ locale: "en", slug: "nurse" }));
        expect(screen.queryByLabelText(translate("en", "ad.advertisement"))).not.toBeInTheDocument();
        expect(document.querySelector("ins.adsbygoogle")).toBeNull();
    });

    it("has a canonical, no hreflang while its German sibling is a draft, and is indexable", () => {
        const metadata = roleExampleMetadata("en", "nurse");
        expect(metadata.alternates?.canonical).toBe("/cv-examples/nurse");
        expect(metadata.alternates?.languages).toBeUndefined();
        expect(metadata.robots).toBeUndefined();
        expect(metadata.title).toContain("Nurse CV Example");
    });

    it("keeps each role's metadata unique", () => {
        const dev = roleExampleMetadata("en", "software-developer");
        const nurse = roleExampleMetadata("en", "nurse");
        expect(dev.title).not.toBe(nurse.title);
        expect(dev.description).not.toBe(nurse.description);
    });
});

describe("long-form sections", () => {
    afterEach(cleanup);

    it("renders each section as an h2 with its paragraphs when the role has them", async () => {
        render(await RoleExamplePage({ locale: "en", slug: "software-developer" }));

        const sections = screen.getByTestId("role-example-sections");
        const headings = within(sections).getAllByRole("heading", { level: 2 });
        expect(headings.map((heading) => heading.textContent)).toEqual([
            "Why this CV works",
            "Keywords to use, and how",
            "Mistakes to avoid on a developer CV",
        ]);
        expect(within(sections).getAllByText(/./, { selector: "p" }).length).toBeGreaterThanOrEqual(6);
        // Still exactly one h1, and the sections sit above the CV text version.
        expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    });

    it("renders nothing, and leaves no gap, for a version without sections (the German drafts)", async () => {
        render(await RoleExamplePage({ locale: "de", slug: "pflegefachkraft" }));
        expect(screen.queryByTestId("role-example-sections")).not.toBeInTheDocument();
    });
});

describe("German draft example", () => {
    afterEach(cleanup);

    it("renders in German with the review notice, and the CV in German", async () => {
        render(await RoleExamplePage({ locale: "de", slug: "pflegefachkraft" }));

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Lebenslauf Pflegefachkraft");
        expect(screen.getByTestId("role-example-draft-notice")).toHaveTextContent(translate("de", "roleExamples.draftNotice"));
        expect(screen.getByRole("heading", { level: 2, name: translate("de", "roleExamples.tipsHeading") })).toBeInTheDocument();
        expect(screen.getByTestId("role-example-text")).toHaveTextContent("Gesundheits- und Krankenpflegerin");
    });

    it("is noindex and declares no alternates", () => {
        const metadata = roleExampleMetadata("de", "pflegefachkraft");
        expect(metadata.robots).toEqual({ index: false, follow: true });
        expect(metadata.alternates?.languages).toBeUndefined();
        expect(metadata.alternates?.canonical).toBe("/de/cv-examples/pflegefachkraft");
    });
});

describe("unknown pages", () => {
    it("404s for an unknown slug, a slug from another language, and a language without examples", async () => {
        await expect(RoleExamplePage({ locale: "en", slug: "nope" })).rejects.toThrow("NEXT_NOT_FOUND");
        await expect(RoleExamplePage({ locale: "en", slug: "pflegefachkraft" })).rejects.toThrow("NEXT_NOT_FOUND");
        await expect(RoleExamplePage({ locale: "fr", slug: "nurse" })).rejects.toThrow("NEXT_NOT_FOUND");
    });
});
