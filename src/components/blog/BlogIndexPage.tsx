import type { Metadata } from "next";
import { BlogIndexContent } from "@/components/blog/BlogIndexContent";
import { BlogLayout } from "@/components/blog/BlogLayout";
import { getAllBlogPostMeta } from "@/lib/blog";
import { blogIndexAlternates, blogIndexPath, blogIndexPosts, getBlogIndexLocales, indexLanguageLinks, shouldOfferEnglishPosts } from "@/lib/blog-articles";
import { translateBlog } from "@/lib/blog-i18n";
import { OG_LOCALES, type Locale } from "@/lib/i18n/locales";
import { LanguageLinksProvider, RouteLocaleProvider } from "@/lib/i18n/route-locale";
import { pageMetadata } from "@/lib/site";

export async function blogIndexMetadata(locale: Locale): Promise<Metadata> {
    const indexLocales = getBlogIndexLocales(await getAllBlogPostMeta());
    const hasPublishedPosts = indexLocales.includes(locale);
    const languages = hasPublishedPosts ? blogIndexAlternates(indexLocales) : {};
    return {
        ...pageMetadata({
            title: translateBlog(locale, "eyebrow"),
            description: translateBlog(locale, "index.description"),
            path: blogIndexPath(locale),
            ogLocale: OG_LOCALES[locale],
            ...(Object.keys(languages).length > 0 ? { languages } : {}),
        }),
        ...(!hasPublishedPosts ? { robots: { index: false, follow: true } } : {}),
    };
}

/** Keep the selected language even before it has published articles. Never list drafts. */
export async function BlogIndexPage({ locale }: { locale: Locale }) {
    const allPosts = await getAllBlogPostMeta();

    return (
        <RouteLocaleProvider locale={locale}>
            <LanguageLinksProvider links={indexLanguageLinks()}>
                <BlogLayout>
                    <BlogIndexContent posts={blogIndexPosts(allPosts, locale)} showEnglishLink={shouldOfferEnglishPosts(allPosts, locale)} />
                </BlogLayout>
            </LanguageLinksProvider>
        </RouteLocaleProvider>
    );
}
