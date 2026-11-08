import type { MetadataRoute } from "next";
import { getAllBlogPostMeta } from "@/lib/blog";
import {
    articleAlternates,
    articleVersions,
    blogIndexAlternates,
    blogIndexPath,
    getBlogIndexLocales,
    publishedVersions,
} from "@/lib/blog-articles";
import { isLegalNoticeReady } from "@/lib/legal-operator";
import { DEFAULT_LOCALE, PREFIXED_LOCALES, localeAlternates, localizedPath } from "@/lib/i18n/locales";
import { RESOURCES_PATH } from "@/lib/resources";
import { entryPath, exampleAlternates, indexAlternates as exampleIndexAlternates, indexLocales as exampleIndexLocales, publishedEntries, roleExamplePath } from "@/lib/role-examples/rules";
import { PUBLIC_ROUTES, SITE_URL } from "@/lib/site";
import { GALLERY_PATH, galleryTemplatePath, getGalleryTemplates } from "@/lib/templates/gallery";
import { TOOLS_PATH, getEnabledTools, toolPath } from "@/lib/tools/registry";

// Pages that exist in every locale; each is listed once per locale with hreflang.
const LOCALIZED_ROUTES = new Set<string>(["/"]);
const GALLERY_ROUTES = [GALLERY_PATH, ...getGalleryTemplates().map(({ slug }) => galleryTemplatePath(slug))];
const LOCALES = [DEFAULT_LOCALE, ...PREFIXED_LOCALES];

function absolute(path: string) {
    return `${SITE_URL}${path === "/" ? "" : path}`;
}

function languageAlternates(path: string) {
    return Object.fromEntries(Object.entries(localeAlternates(path)).map(([lang, href]) => [lang, absolute(href)]));
}

function withLanguages(entry: MetadataRoute.Sitemap[number], languages: Record<string, string>): MetadataRoute.Sitemap[number] {
    if (Object.keys(languages).length === 0) return entry;
    return {
        ...entry,
        alternates: { languages: Object.fromEntries(Object.entries(languages).map(([lang, path]) => [lang, absolute(path)])) },
    };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // The legal notice is listed only once the operator details are filled in.
    // The blog index is listed with the blog below, once per language that has posts.
    const routes: string[] = [...PUBLIC_ROUTES.filter((path) => path !== "/blog"), ...(isLegalNoticeReady() ? ["/impressum"] : [])];
    const pages = routes.map((path) => ({
        url: absolute(path),
        changeFrequency: path === "/" ? "weekly" : "monthly",
        priority: path === "/" ? 1 : 0.6,
        ...(LOCALIZED_ROUTES.has(path) ? { alternates: { languages: languageAlternates(path) } } : {}),
    } satisfies MetadataRoute.Sitemap[number]));

    // Gallery and tool pages are listed in English only. Their translations are
    // short chrome translations (about 70-200 words each) that stay reachable and
    // linked from the language switcher, but are not advertised until each has
    // enough original content to stand on its own.
    const galleryPages = GALLERY_ROUTES.map((path) => ({
        url: absolute(path),
        changeFrequency: "monthly",
        priority: path === GALLERY_PATH ? 0.8 : 0.7,
    } satisfies MetadataRoute.Sitemap[number]));

    const toolRoutes = [TOOLS_PATH, ...getEnabledTools().map(({ slug }) => toolPath(slug)), RESOURCES_PATH];
    const toolPages = toolRoutes.map((path) => ({
        url: absolute(path),
        changeFrequency: "monthly",
        priority: 0.8,
    } satisfies MetadataRoute.Sitemap[number]));

    const localizedPages = [...LOCALIZED_ROUTES].flatMap((path) => PREFIXED_LOCALES.map((locale) => ({
        url: absolute(localizedPath(path, locale)),
        changeFrequency: "weekly",
        priority: 0.9,
        alternates: { languages: languageAlternates(path) },
    } satisfies MetadataRoute.Sitemap[number])));

    // Blog: published versions only (drafts are noindex), each with its language siblings.
    const allPosts = await getAllBlogPostMeta();
    const indexLocales = getBlogIndexLocales(allPosts);
    const blogIndexes = indexLocales.map((locale) => withLanguages({
        url: absolute(blogIndexPath(locale)),
        changeFrequency: "weekly",
        priority: 0.6,
    }, blogIndexAlternates(indexLocales)));
    const posts = publishedVersions(allPosts).map((post) => withLanguages({
        url: absolute(post.path),
        lastModified: post.updated ?? post.date,
        changeFrequency: "yearly",
        priority: 0.7,
    }, articleAlternates(articleVersions(post, allPosts))));

    // Role examples: published versions only (drafts are noindex), each with its published siblings.
    const exampleIndexes = exampleIndexLocales().map((locale) => withLanguages({
        url: absolute(roleExamplePath(locale)),
        changeFrequency: "weekly",
        priority: 0.8,
    }, exampleIndexAlternates()));
    const examplePages = publishedEntries().map((entry) => withLanguages({
        url: absolute(entryPath(entry)),
        lastModified: entry.version.date,
        changeFrequency: "monthly",
        priority: 0.7,
    }, exampleAlternates(entry.role)));

    return [...pages, ...localizedPages, ...galleryPages, ...toolPages, ...exampleIndexes, ...examplePages, ...blogIndexes, ...posts];
}
