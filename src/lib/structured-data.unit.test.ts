import { describe, expect, it } from "vitest";
import type { BlogPostMeta } from "@/lib/blog";
import { getBlogAuthor } from "@/lib/blog-authors";
import { DEFAULT_LOCALE, PREFIXED_LOCALES, type Locale } from "@/lib/i18n/locales";
import { translate } from "@/lib/i18n/translate";
import { LANDING_FAQ_KEYS } from "@/lib/landing-faq";
import { SITE_URL } from "@/lib/site";
import {
    ORGANIZATION_SAME_AS,
    blogPostBreadcrumbJsonLd,
    blogPostingJsonLd,
    faqJsonLd,
    galleryTemplateBreadcrumbJsonLd,
    jsonLdString,
    landingFaqJsonLd,
    organizationJsonLd,
    softwareApplicationJsonLd,
    toolBreadcrumbJsonLd,
    type JsonLdNode,
} from "@/lib/structured-data";
import { getGalleryTemplates } from "@/lib/templates/gallery";
import { getTools } from "@/lib/tools/registry";

const LOCALES: Locale[] = [DEFAULT_LOCALE, ...PREFIXED_LOCALES];

function post(overrides: Partial<BlogPostMeta>): BlogPostMeta {
    return {
        title: "Common Resume Mistakes",
        description: "Remove the mistakes that make a resume vague.",
        slug: "common-resume-mistakes",
        date: "2026-05-03",
        tags: ["resume mistakes"],
        sponsored: false,
        adSlots: [],
        authorId: "safet-imamovic",
        author: getBlogAuthor("safet-imamovic")!,
        toc: [],
        readingTimeMinutes: 4,
        locale: "en",
        article: "common-resume-mistakes",
        draft: false,
        path: "/blog/common-resume-mistakes",
        sourcePath: "common-resume-mistakes.mdx",
        ...overrides,
    };
}

/** Round-trips nodes through the string the page embeds. */
function embedded(nodes: JsonLdNode[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- parsed JSON, read by path in assertions
    return JSON.parse(jsonLdString(nodes)) as { "@context": string; "@graph": Array<Record<string, any>> };
}

describe("jsonLdString", () => {
    it("produces parseable schema.org JSON with a graph", () => {
        const parsed = embedded([organizationJsonLd()]);
        expect(parsed["@context"]).toBe("https://schema.org");
        expect(parsed["@graph"][0]["@type"]).toBe("Organization");
    });

    it("cannot close the script tag, and still parses back to the original text", () => {
        const hostile = "</script><script>alert(1)</script>";
        const out = jsonLdString([{ "@type": "Thing", name: hostile }]);
        expect(out).not.toContain("<");
        expect(JSON.parse(out)["@graph"][0].name).toBe(hostile);
    });
});

describe("landing structured data", () => {
    it("links the app to an organization whose profiles are absolute https URLs", () => {
        const org = organizationJsonLd();
        expect(org.logo).toBe(`${SITE_URL}/logo.png`);
        for (const url of ORGANIZATION_SAME_AS) expect(url).toMatch(/^https:\/\//);
    });

    it.each(LOCALES)("describes a free web app in %s", (locale) => {
        const [app] = embedded([softwareApplicationJsonLd(locale)])["@graph"];
        expect(app).toMatchObject({
            "@type": "SoftwareApplication",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            inLanguage: locale,
            offers: { "@type": "Offer", price: "0" },
        });
        expect(app.url).toBe(locale === "en" ? SITE_URL : `${SITE_URL}/${locale}`);
        expect(app.description).toBe(translate(locale, "meta.landingDescription"));
    });

    it.each(LOCALES)("lists the visible FAQ in %s with every placeholder filled", (locale) => {
        const [faq] = embedded([landingFaqJsonLd(locale)])["@graph"];
        expect(faq["@type"]).toBe("FAQPage");
        expect(faq.mainEntity).toHaveLength(LANDING_FAQ_KEYS.length);
        LANDING_FAQ_KEYS.forEach(({ q }, i) => {
            const entry = faq.mainEntity[i];
            expect(entry.name).toBe(translate(locale, q));
            expect(entry.acceptedAnswer.text).not.toMatch(/\{\w+\}/);
            expect(entry.acceptedAnswer.text.length).toBeGreaterThan(0);
        });
    });
});

describe("blog structured data", () => {
    it("describes a post as a BlogPosting by its author", () => {
        const meta = post({});
        const [article, breadcrumb] = embedded([blogPostingJsonLd(meta), blogPostBreadcrumbJsonLd(meta)])["@graph"];
        expect(article).toMatchObject({
            "@type": "BlogPosting",
            headline: meta.title,
            url: `${SITE_URL}/blog/common-resume-mistakes`,
            datePublished: "2026-05-03",
            dateModified: "2026-05-03",
            author: { "@type": "Person", name: meta.author.name },
        });
        expect(article.author.url).toMatch(/^https:\/\//);
        expect(article.image).toMatch(/^https:\/\//);
        expect(breadcrumb.itemListElement.map((item: { item: string }) => item.item)).toEqual([
            SITE_URL,
            `${SITE_URL}/blog`,
            `${SITE_URL}/blog/common-resume-mistakes`,
        ]);
    });

    it("describes a German post in German, with a German breadcrumb trail", () => {
        const meta = post({
            locale: "de",
            slug: "sprachniveau-im-lebenslauf-angeben",
            path: "/de/blog/sprachniveau-im-lebenslauf-angeben",
            title: "Sprachniveau im Lebenslauf angeben (A1–C2)",
        });
        const [article, breadcrumb] = embedded([blogPostingJsonLd(meta), blogPostBreadcrumbJsonLd(meta)])["@graph"];

        expect(article).toMatchObject({
            inLanguage: "de",
            url: `${SITE_URL}/de/blog/sprachniveau-im-lebenslauf-angeben`,
        });
        expect(breadcrumb.itemListElement.map((item: { item: string; name: string }) => [item.name, item.item])).toEqual([
            ["EngineCV", `${SITE_URL}/de`],
            ["Blog", `${SITE_URL}/de/blog`],
            [meta.title, `${SITE_URL}/de/blog/sprachniveau-im-lebenslauf-angeben`],
        ]);
    });

    it("reports the updated date as dateModified", () => {
        const [article] = embedded([blogPostingJsonLd(post({ updated: "2026-09-30" }))])["@graph"];
        expect(article.datePublished).toBe("2026-05-03");
        expect(article.dateModified).toBe("2026-09-30");
    });
});

describe("gallery breadcrumbs", () => {
    const cases = LOCALES.flatMap((locale) => getGalleryTemplates().map((entry) => [locale, entry.slug, entry] as const));

    it.each(cases)("%s %s has a three-step trail in the page's locale", (locale, slug, entry) => {
        const [crumbs] = embedded([galleryTemplateBreadcrumbJsonLd(locale, entry)])["@graph"];
        const prefix = locale === "en" ? SITE_URL : `${SITE_URL}/${locale}`;
        expect(crumbs.itemListElement).toEqual([
            { "@type": "ListItem", position: 1, name: "EngineCV", item: prefix },
            { "@type": "ListItem", position: 2, name: translate(locale, "nav.templates"), item: `${prefix}/cv-templates` },
            { "@type": "ListItem", position: 3, name: entry.template.meta.name, item: `${prefix}/cv-templates/${slug}` },
        ]);
    });
});

describe("translate", () => {
    it("fills every occurrence of a placeholder", () => {
        expect(translate("en", "{a} and {a}", { a: "x" })).toBe("x and x");
    });
});

describe("tool structured data", () => {
    it.each(getTools().map((tool) => [tool.slug, tool] as const))("%s FAQ lists the visible questions in every locale", (_slug, tool) => {
        for (const locale of LOCALES) {
            const [faq] = embedded([faqJsonLd(locale, tool.faq)])["@graph"];
            expect(faq).toMatchObject({ "@type": "FAQPage", inLanguage: locale });
            expect(faq.mainEntity).toHaveLength(tool.faq.length);
            tool.faq.forEach(({ q, a }, i) => {
                expect(faq.mainEntity[i].name).toBe(translate(locale, q));
                expect(faq.mainEntity[i].acceptedAnswer.text).toBe(translate(locale, a));
            });
        }
    });

    it("builds localized Home > Tools > tool breadcrumbs", () => {
        const tool = getTools()[0];
        const [crumbs] = embedded([toolBreadcrumbJsonLd("de", tool)])["@graph"];
        expect(crumbs.itemListElement.map((item: JsonLdNode) => item.item)).toEqual([
            `${SITE_URL}/de`,
            `${SITE_URL}/de/tools`,
            `${SITE_URL}/de/tools/${tool.slug}`,
        ]);
        expect(crumbs.itemListElement[2].name).toBe(translate("de", `${tool.keyPrefix}.title`));
    });

    it("stops at Tools for the index", () => {
        const [crumbs] = embedded([toolBreadcrumbJsonLd("en")])["@graph"];
        expect(crumbs.itemListElement.map((item: JsonLdNode) => item.item)).toEqual([SITE_URL, `${SITE_URL}/tools`]);
    });
});
