import type { BlogPostMeta } from "@/lib/blog";
import { blogIndexPath } from "@/lib/blog-articles";
import { translateBlog } from "@/lib/blog-i18n";
import { GUIDE_COPY } from "@/lib/guides/copy";
import type { GuideFaqItem, GuideMeta } from "@/lib/guides/guides";
import { getExportFormatClaimParams } from "@/lib/export-formats";
import { localizedPath, type Locale } from "@/lib/i18n/locales";
import { translate } from "@/lib/i18n/translate";
import { LANDING_FAQ_KEYS } from "@/lib/landing-faq";
import { entryPath, roleExamplePath, type RoleExampleEntry } from "@/lib/role-examples/rules";
import { GUIDES_PATH, SHARE_IMAGE, SITE_NAME, SITE_URL } from "@/lib/site";
import { ENGINECV_KOFI_URL } from "@/lib/support";
import { GALLERY_PATH, galleryTemplatePath, type GalleryTemplate } from "@/lib/templates/gallery";
import { TOOLS_PATH, toolPath, type ToolDefinition, type ToolFaqKey } from "@/lib/tools/registry";

/**
 * schema.org JSON-LD for public pages. Builders return plain objects; JsonLd
 * renders them into one `@graph` per page.
 */
export type JsonLdNode = Record<string, unknown>;

const ORGANIZATION_ID = `${SITE_URL}/#organization`;

/**
 * Profiles that belong to EngineCV itself. A personal profile or the private
 * GitHub repository does not belong here; add an org page once one exists.
 */
export const ORGANIZATION_SAME_AS = [ENGINECV_KOFI_URL, "https://github.com/enginecv"] as const;

export function absoluteUrl(path: string): string {
    return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

/** JSON for an inline script. `<` is escaped so content can never close the tag. */
export function jsonLdString(nodes: JsonLdNode[]): string {
    const json = JSON.stringify({ "@context": "https://schema.org", "@graph": nodes });
    return json.replace(/</g, "\\" + "u003c");
}

export function organizationJsonLd(): JsonLdNode {
    return {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: SITE_NAME,
        url: SITE_URL,
        logo: absoluteUrl("/logo.png"),
        sameAs: [...ORGANIZATION_SAME_AS],
    };
}

export function softwareApplicationJsonLd(locale: Locale): JsonLdNode {
    return {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        url: absoluteUrl(localizedPath("/", locale)),
        description: translate(locale, "meta.landingDescription"),
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        inLanguage: locale,
        image: absoluteUrl(SHARE_IMAGE.url),
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
        publisher: { "@id": ORGANIZATION_ID },
    };
}

/** A FAQPage with the same questions and answers the page shows, read from translation keys. */
export function faqJsonLd(
    locale: Locale,
    keys: readonly ToolFaqKey[],
    params?: Record<string, string | number>,
): JsonLdNode {
    return {
        "@type": "FAQPage",
        inLanguage: locale,
        mainEntity: keys.map(({ q, a }) => ({
            "@type": "Question",
            name: translate(locale, q),
            acceptedAnswer: { "@type": "Answer", text: translate(locale, a, params) },
        })),
    };
}

/** The landing FAQ, with the same questions and answers the page shows. */
export function landingFaqJsonLd(locale: Locale): JsonLdNode {
    return faqJsonLd(locale, LANDING_FAQ_KEYS, getExportFormatClaimParams((key) => translate(locale, key)));
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>): JsonLdNode {
    return {
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: absoluteUrl(item.path),
        })),
    };
}

export function blogPostingJsonLd(post: BlogPostMeta): JsonLdNode {
    const url = absoluteUrl(post.path);
    const authorUrl = post.author.links.website || post.author.links.linkedin;
    return {
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        url,
        mainEntityOfPage: url,
        datePublished: post.date,
        dateModified: post.updated ?? post.date,
        inLanguage: post.locale,
        keywords: post.tags,
        image: absoluteUrl(SHARE_IMAGE.url),
        author: { "@type": "Person", name: post.author.name, ...(authorUrl ? { url: authorUrl } : {}) },
        publisher: { "@id": ORGANIZATION_ID },
    };
}

export function blogPostBreadcrumbJsonLd(post: BlogPostMeta): JsonLdNode {
    return breadcrumbJsonLd([
        { name: SITE_NAME, path: localizedPath("/", post.locale) },
        // A published post means its language has a blog index.
        { name: translateBlog(post.locale, "breadcrumb"), path: blogIndexPath(post.locale) },
        { name: post.title, path: post.path },
    ]);
}

export function guideArticleJsonLd(guide: GuideMeta): JsonLdNode {
    const url = absoluteUrl(guide.path);
    const authorUrl = guide.author.links.website || guide.author.links.linkedin;
    return {
        "@type": "Article",
        headline: guide.title,
        description: guide.description,
        url,
        mainEntityOfPage: url,
        datePublished: guide.date,
        dateModified: guide.updated ?? guide.date,
        inLanguage: "en",
        keywords: guide.tags,
        image: absoluteUrl(SHARE_IMAGE.url),
        author: { "@type": "Person", name: guide.author.name, ...(authorUrl ? { url: authorUrl } : {}) },
        publisher: { "@id": ORGANIZATION_ID },
    };
}

export function guideBreadcrumbJsonLd(guide: GuideMeta): JsonLdNode {
    return breadcrumbJsonLd([
        { name: SITE_NAME, path: "/" },
        { name: GUIDE_COPY.breadcrumb, path: GUIDES_PATH },
        { name: guide.title, path: guide.path },
    ]);
}

/** FAQPage for a guide, from the literal questions and answers the page shows. */
export function guideFaqJsonLd(faq: readonly GuideFaqItem[]): JsonLdNode {
    return {
        "@type": "FAQPage",
        inLanguage: "en",
        mainEntity: faq.map(({ q, a }) => ({
            "@type": "Question",
            name: q,
            acceptedAnswer: { "@type": "Answer", text: a },
        })),
    };
}

export function galleryTemplateBreadcrumbJsonLd(locale: Locale, entry: GalleryTemplate): JsonLdNode {
    return breadcrumbJsonLd([
        { name: SITE_NAME, path: localizedPath("/", locale) },
        { name: translate(locale, "nav.templates"), path: localizedPath(GALLERY_PATH, locale) },
        { name: entry.template.meta.name, path: localizedPath(galleryTemplatePath(entry.slug), locale) },
    ]);
}

/** Home > Tools, or Home > Tools > tool when a tool is given. */
export function toolBreadcrumbJsonLd(locale: Locale, tool?: ToolDefinition): JsonLdNode {
    return breadcrumbJsonLd([
        { name: SITE_NAME, path: localizedPath("/", locale) },
        { name: translate(locale, "tools.breadcrumb"), path: localizedPath(TOOLS_PATH, locale) },
        ...(tool ? [{ name: translate(locale, `${tool.keyPrefix}.title`), path: localizedPath(toolPath(tool.slug), locale) }] : []),
    ]);
}

/** Home > CV examples > role example. */
export function roleExampleBreadcrumbJsonLd(locale: Locale, entry: RoleExampleEntry): JsonLdNode {
    return breadcrumbJsonLd([
        { name: SITE_NAME, path: localizedPath("/", locale) },
        { name: translate(locale, "roleExamples.indexTitle"), path: roleExamplePath(locale) },
        { name: entry.version.title, path: entryPath(entry) },
    ]);
}
