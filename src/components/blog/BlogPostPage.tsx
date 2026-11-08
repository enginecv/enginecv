import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogLayout } from "@/components/blog/BlogLayout";
import { CTA } from "@/components/blog/CTA";
import { DraftNotice } from "@/components/blog/DraftNotice";
import { PostContent } from "@/components/blog/PostContent";
import { PostHeader } from "@/components/blog/PostHeader";
import { PostSidebar } from "@/components/blog/PostSidebar";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAllBlogPostMeta, getBlogPost } from "@/lib/blog";
import { articleAlternates, articleVersions, blogIndexPath, postLanguageLinks } from "@/lib/blog-articles";
import { OG_LOCALES, type Locale } from "@/lib/i18n/locales";
import { translate } from "@/lib/i18n/translate";
import { LanguageLinksProvider, RouteLocaleProvider } from "@/lib/i18n/route-locale";
import { SHARE_IMAGE, SITE_NAME } from "@/lib/site";
import { blogPostBreadcrumbJsonLd, blogPostingJsonLd } from "@/lib/structured-data";

/** Metadata for one language version: canonical, hreflang siblings, and noindex for drafts. */
export async function blogPostMetadata(locale: Locale, slug: string): Promise<Metadata> {
    const post = await getBlogPost(locale, slug);
    if (!post) return { title: translate(locale, "blog.notFound") };

    const languages = post.draft ? {} : articleAlternates(articleVersions(post, await getAllBlogPostMeta()));

    return {
        title: post.title,
        description: post.description,
        keywords: post.tags,
        authors: [
            {
                name: post.author.name,
                url: post.author.links.website || post.author.links.linkedin || undefined,
            },
        ],
        creator: post.author.name,
        alternates: {
            canonical: post.path,
            ...(Object.keys(languages).length > 0 ? { languages } : {}),
        },
        openGraph: {
            title: post.title,
            url: post.path,
            siteName: SITE_NAME,
            images: [SHARE_IMAGE],
            description: post.description,
            type: "article",
            locale: OG_LOCALES[locale],
            publishedTime: post.date,
            modifiedTime: post.updated,
            tags: post.tags,
            authors: [post.author.name],
        },
        // Drafts are reachable by link for reviewers, never indexed.
        ...(post.draft ? { robots: { index: false, follow: true } } : {}),
    };
}

/** A blog post in one language; the URL's language drives every label around it. */
export async function BlogPostPage({ locale, slug }: { locale: Locale; slug: string }) {
    const post = await getBlogPost(locale, slug);
    if (!post) notFound();

    const allPosts = await getAllBlogPostMeta();
    const { body, content, ...postMeta } = post;

    return (
        <RouteLocaleProvider locale={locale}>
            <LanguageLinksProvider links={postLanguageLinks(postMeta, allPosts)}>
                <BlogLayout>
                    <JsonLd nodes={[blogPostingJsonLd(postMeta), blogPostBreadcrumbJsonLd(postMeta)]} />
                    <article className="mx-auto max-w-6xl">
                        {postMeta.draft ? <DraftNotice locale={locale} /> : null}
                        <PostHeader post={postMeta} indexHref={blogIndexPath(locale)} />
                        <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,1fr)_17rem] md:items-start md:gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_19rem] xl:gap-12">
                            <div className="min-w-0">
                                <PostContent body={body} content={content} enabledAdSlots={postMeta.adSlots} />
                                <div className="mt-10">
                                    <CTA />
                                </div>
                            </div>
                            <PostSidebar post={postMeta} />
                        </div>
                    </article>
                </BlogLayout>
            </LanguageLinksProvider>
        </RouteLocaleProvider>
    );
}
