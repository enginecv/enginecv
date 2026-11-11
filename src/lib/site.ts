import type { Metadata } from "next";
import { DEFAULT_LOCALE, localizedPath, type Locale } from "@/lib/i18n/locales";

/** Canonical origin. `www` and other hosts redirect here at the Cloudflare zone. */
export const SITE_URL = "https://enginecv.app";

export const SITE_NAME = "EngineCV";

/**
 * Public, indexable routes without dynamic segments. The sitemap and the
 * canonical tags read from this list, so a new public page is added here once.
 */
export const PUBLIC_ROUTES = [
    "/",
    "/blog",
    "/changelog",
    "/contact",
    "/privacy",
    "/cookies",
    "/terms",
    "/accessibility",
    "/about",
] as const;

export type PublicRoute = (typeof PUBLIC_ROUTES)[number];

/** App and utility paths crawlers should skip: they hold local user data or no content. */
export const CRAWL_DISALLOWED_PATHS = [
    "/editor/",
    "/templates/",
    "/internal/",
    "/api/",
    "/r/",
    "/go/",
] as const;

/**
 * Query-string variants that duplicate a page crawlers already have: the
 * dashboard tab switch and Next's RSC payload fetches. Bing flagged these as
 * wasted crawl capacity. The bare `/dashboard` stays crawlable so its noindex
 * tag is still read.
 */
export const CRAWL_DISALLOWED_PARAMS = ["/dashboard?", "/*?_rsc="] as const;

/** `/blog/<slug>` in English, `/<locale>/blog/<slug>` otherwise. */
export function blogPostPath(slug: string, locale: Locale = DEFAULT_LOCALE) {
    return localizedPath(`/blog/${slug}`, locale);
}

export const GUIDES_PATH = "/guides";

export function guidePath(slug: string) {
    return `${GUIDES_PATH}/${slug}`;
}

export const SITE_TITLE = "EngineCV — Free Privacy-First Resume Builder";
export const SITE_DESCRIPTION =
    "Build professional resumes instantly. No account required. Runs entirely in your browser. Unlimited CVs, unlimited downloads, 100% free forever.";

/** Share card for every page (1200x630). Blog posts can override it later. */
export const SHARE_IMAGE = {
    url: "/og-image.png",
    width: 1200,
    height: 630,
    alt: "EngineCV: a free resume builder that runs in your browser, with no account and no paywall.",
};

/**
 * Title, description, canonical URL and Open Graph for a public page. Relative
 * paths resolve against `metadataBase` in the root layout.
 */
export function pageMetadata({
    title,
    description,
    path,
    ogLocale = "en",
    languages,
}: {
    title: string;
    description: string;
    path: string;
    /** Open Graph locale, e.g. "de_DE". */
    ogLocale?: string;
    /** hreflang alternates for a page that exists in several languages. */
    languages?: Record<string, string>;
}): Metadata {
    return {
        title,
        description,
        alternates: { canonical: path, ...(languages ? { languages } : {}) },
        openGraph: {
            title,
            description,
            url: path,
            siteName: SITE_NAME,
            type: "website",
            locale: ogLocale,
            images: [SHARE_IMAGE],
        },
    };
}
