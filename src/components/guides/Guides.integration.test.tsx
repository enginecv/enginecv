import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getBlogAuthor } from "@/lib/blog-authors";
import { useI18nStore } from "@/lib/i18n";
import type { Guide, GuideMeta } from "@/lib/guides/guides";
import { GuideFaq } from "./GuideFaq";
import { GuideLanguageNotice } from "./GuideLanguageNotice";
import { GuidesIndex } from "./GuidesIndex";

vi.mock("next/navigation", () => ({
    usePathname: () => "/",
    useRouter: () => ({ prefetch: vi.fn() }),
    notFound: () => {
        throw new Error("NEXT_NOT_FOUND");
    },
}));

function meta(overrides: Partial<GuideMeta>): GuideMeta {
    const slug = overrides.slug ?? "work-experience-section";
    return {
        title: "How to Write the Work Experience Section of Your CV",
        description: "A field-by-field guide.",
        slug,
        date: "2026-11-10",
        updated: "2026-11-12",
        tags: ["work experience"],
        adSlots: [],
        faq: [{ q: "How many jobs?", a: "The last ten to fifteen years." }],
        draft: false,
        sponsored: false,
        path: `/guides/${slug}`,
        sourcePath: `${slug}.mdx`,
        author: getBlogAuthor("safet-imamovic")!,
        toc: [],
        readingTimeMinutes: 7,
        order: 1,
        ...overrides,
    };
}

const published = meta({});
const draft = meta({ slug: "education-section", title: "Education draft", draft: true, order: 2 });

vi.mock("@/lib/guides/guides", () => ({
    getGuide: async (slug: string) => [published, draft].find((guide) => guide.slug === slug) as Guide | undefined ?? null,
    getAllGuideMeta: async () => [published, draft],
    getPublishedGuideMeta: async () => [published],
}));

const { guideMetadata } = await import("./GuidePage");

describe("guides hub list", () => {
    afterEach(cleanup);

    it("lists the guides it is given, with a link and reading time", () => {
        render(<GuidesIndex guides={[published]} />);
        expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: published.title })).toHaveAttribute("href", "/guides/work-experience-section");
        expect(screen.getByText("7 min read")).toBeInTheDocument();
        expect(screen.queryByText(draft.title)).not.toBeInTheDocument();
    });

    it("shows an empty state when nothing is published", () => {
        render(<GuidesIndex guides={[]} />);
        expect(screen.getByTestId("guides-empty")).toBeInTheDocument();
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });
});

describe("guide FAQ", () => {
    afterEach(cleanup);

    it("shows each question and emits matching FAQPage data", () => {
        const faq = [
            { q: "How many jobs?", a: "The last ten to fifteen years." },
            { q: "How many bullets?", a: "Three to six." },
        ];
        const { container } = render(<GuideFaq faq={faq} />);

        expect(screen.getByText("How many jobs?")).toBeInTheDocument();
        expect(screen.getByText("Three to six.")).toBeInTheDocument();

        const script = container.querySelector('script[type="application/ld+json"]');
        const data = JSON.parse(script!.textContent!);
        const page = (data["@graph"] ?? [data]).find((node: { "@type": string }) => node["@type"] === "FAQPage");
        expect(page.mainEntity.map((item: { name: string }) => item.name)).toEqual(faq.map((item) => item.q));
    });

    it("renders nothing without questions", () => {
        const { container } = render(<GuideFaq faq={[]} />);
        expect(container).toBeEmptyDOMElement();
    });
});

describe("guide English-only notice", () => {
    beforeEach(() => {
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(() => {
        cleanup();
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    it("is hidden in English", () => {
        render(<GuideLanguageNotice />);
        expect(screen.queryByTestId("guide-english-only")).not.toBeInTheDocument();
    });

    it.each(["de", "bs", "fr", "es"] as const)("is shown in %s", (locale) => {
        useI18nStore.setState({ locale, _hydrated: true });
        render(<GuideLanguageNotice />);
        expect(screen.getByTestId("guide-english-only")).toBeInTheDocument();
    });
});

describe("guide metadata", () => {
    it("declares one canonical address, article details and no robots rule for a published guide", async () => {
        const metadata = await guideMetadata(published.slug);
        expect(metadata.alternates?.canonical).toBe("/guides/work-experience-section");
        expect(metadata.robots).toBeUndefined();
        expect((metadata.openGraph as { type?: string }).type).toBe("article");
        expect((metadata.openGraph as { modifiedTime?: string }).modifiedTime).toBe("2026-11-12");
    });

    it("marks a draft noindex", async () => {
        const metadata = await guideMetadata(draft.slug);
        expect(metadata.robots).toEqual({ index: false, follow: true });
    });
});
