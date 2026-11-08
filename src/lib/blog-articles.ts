import { DEFAULT_LOCALE, PREFIXED_LOCALES, localizedPath, type Locale } from "./i18n/locales";

/*
 * Pure rules for multilingual blog articles: which versions belong together,
 * which are public, and where search engines and the language switcher should
 * point. Everything here takes plain post metadata, so it runs at build time
 * and in tests without the content collection.
 */

const BLOG_PATH = "/blog";
const ALL_LOCALES: readonly Locale[] = [DEFAULT_LOCALE, ...PREFIXED_LOCALES];

/** The fields these rules need; `BlogPostMeta` satisfies it. */
export interface BlogVersion {
    slug: string;
    locale: Locale;
    article: string;
    draft: boolean;
    date: string;
    path: string;
    sourcePath: string;
}

export interface BlogArticle<T extends BlogVersion = BlogVersion> {
    id: string;
    versions: T[];
}

export type LanguageLinks = Record<Locale, string>;

/** Fails the build on two versions sharing a slug in one language, or two versions of one article in one language. */
export function validateBlogVersions(versions: readonly BlogVersion[]) {
    const bySlug = new Map<string, BlogVersion>();
    const byArticle = new Map<string, BlogVersion>();

    for (const version of versions) {
        const slugKey = `${version.locale}/${version.slug}`;
        const sameSlug = bySlug.get(slugKey);
        if (sameSlug) {
            throw new Error(
                `Blog slug "${version.slug}" is used twice in "${version.locale}": ${sameSlug.sourcePath} and ${version.sourcePath}`,
            );
        }
        bySlug.set(slugKey, version);

        const articleKey = `${version.article}/${version.locale}`;
        const sameArticle = byArticle.get(articleKey);
        if (sameArticle) {
            throw new Error(
                `Blog article "${version.article}" has two "${version.locale}" versions: ${sameArticle.sourcePath} and ${version.sourcePath}`,
            );
        }
        byArticle.set(articleKey, version);
    }
}

export function groupArticles<T extends BlogVersion>(versions: readonly T[]): BlogArticle<T>[] {
    const articles = new Map<string, T[]>();
    for (const version of versions) {
        articles.set(version.article, [...(articles.get(version.article) ?? []), version]);
    }
    return [...articles].map(([id, articleVersions]) => ({ id, versions: articleVersions }));
}

export function publishedVersions<T extends BlogVersion>(versions: readonly T[]): T[] {
    return versions.filter((version) => !version.draft);
}

/** The other versions of `version`'s article, itself included. */
export function articleVersions<T extends BlogVersion>(version: BlogVersion, versions: readonly T[]): T[] {
    return versions.filter((candidate) => candidate.article === version.article);
}

/**
 * hreflang map for an article: every published version, plus x-default (the
 * English version, else the earliest published one). Empty when fewer than
 * two versions are published, since a lone page needs only its canonical.
 */
export function articleAlternates(versions: readonly BlogVersion[]): Record<string, string> {
    const published = publishedVersions(versions);
    if (published.length < 2) return {};

    const byDate = [...published].sort((left, right) => left.date.localeCompare(right.date));
    const fallback = published.find((version) => version.locale === DEFAULT_LOCALE) ?? byDate[0];

    return {
        ...Object.fromEntries(orderByLocale(published).map((version) => [version.locale, version.path])),
        "x-default": fallback.path,
    };
}

/** Published versions in one language, newest first. */
export function blogIndexPosts<T extends BlogVersion>(versions: readonly T[], locale: Locale): T[] {
    return publishedVersions(versions)
        .filter((version) => version.locale === locale)
        .sort((left, right) => right.date.localeCompare(left.date));
}

/** Offer extra English reading only while the local published collection is small. */
export function shouldOfferEnglishPosts(versions: readonly BlogVersion[], locale: Locale): boolean {
    if (locale === DEFAULT_LOCALE) return false;
    const published = publishedVersions(versions);
    const localPosts = published.filter((version) => version.locale === locale);
    if (localPosts.length >= 3) return false;
    const localArticles = new Set(localPosts.map((version) => version.article));
    return published.some((version) => version.locale === DEFAULT_LOCALE && !localArticles.has(version.article));
}

/** Languages with published content; only these indexes enter the sitemap and hreflang. */
export function getBlogIndexLocales(versions: readonly BlogVersion[]): Locale[] {
    const locales = new Set(publishedVersions(versions).map((version) => version.locale));
    return ALL_LOCALES.filter((locale) => locales.has(locale));
}

export function blogIndexPath(locale: Locale): string {
    return localizedPath(BLOG_PATH, locale);
}

/** hreflang map for the blog indexes; empty when only one language has one. */
export function blogIndexAlternates(indexLocales: readonly Locale[]): Record<string, string> {
    if (indexLocales.length < 2) return {};
    const fallback = indexLocales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : indexLocales[0];
    return {
        ...Object.fromEntries(indexLocales.map((locale) => [locale, blogIndexPath(locale)])),
        "x-default": blogIndexPath(fallback),
    };
}

/**
 * Language switcher targets on a post: the same article's published version
 * in that language, else that language's blog index (including empty indexes).
 */
export function postLanguageLinks(version: BlogVersion, versions: readonly BlogVersion[]): LanguageLinks {
    const siblings = publishedVersions(articleVersions(version, versions));

    return Object.fromEntries(ALL_LOCALES.map((locale) => {
        if (locale === version.locale) return [locale, version.path];
        const sibling = siblings.find((candidate) => candidate.locale === locale);
        return [locale, sibling?.path ?? blogIndexPath(locale)];
    })) as LanguageLinks;
}

/** Language switcher targets on a blog index. */
export function indexLanguageLinks(): LanguageLinks {
    return Object.fromEntries(ALL_LOCALES.map((locale) => [locale, blogIndexPath(locale)])) as LanguageLinks;
}

function orderByLocale<T extends BlogVersion>(versions: readonly T[]): T[] {
    return [...versions].sort((left, right) => ALL_LOCALES.indexOf(left.locale) - ALL_LOCALES.indexOf(right.locale));
}
