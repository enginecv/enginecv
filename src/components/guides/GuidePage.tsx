import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogLayout } from "@/components/blog/BlogLayout";
import { CTA } from "@/components/blog/CTA";
import { PostContent } from "@/components/blog/PostContent";
import { PostHeader } from "@/components/blog/PostHeader";
import { PostSidebar } from "@/components/blog/PostSidebar";
import { GuideFaq } from "@/components/guides/GuideFaq";
import { GuideLanguageNotice } from "@/components/guides/GuideLanguageNotice";
import { RelatedLinks } from "@/components/guides/RelatedLinks";
import { JsonLd } from "@/components/seo/JsonLd";
import { GUIDE_COPY } from "@/lib/guides/copy";
import { getGuide } from "@/lib/guides/guides";
import { GUIDES_PATH, SHARE_IMAGE, SITE_NAME } from "@/lib/site";
import { guideArticleJsonLd, guideBreadcrumbJsonLd } from "@/lib/structured-data";

/** Metadata for one guide: canonical, article details, and noindex for drafts. */
export async function guideMetadata(slug: string): Promise<Metadata> {
    const guide = await getGuide(slug);
    if (!guide) return { title: GUIDE_COPY.notFoundTitle };

    return {
        title: guide.title,
        description: guide.description,
        keywords: guide.tags,
        authors: [{ name: guide.author.name, url: guide.author.links.website || guide.author.links.linkedin || undefined }],
        creator: guide.author.name,
        alternates: { canonical: guide.path },
        openGraph: {
            title: guide.title,
            url: guide.path,
            siteName: SITE_NAME,
            images: [SHARE_IMAGE],
            description: guide.description,
            type: "article",
            locale: "en_US",
            publishedTime: guide.date,
            modifiedTime: guide.updated,
            tags: guide.tags,
            authors: [guide.author.name],
        },
        // Drafts are reachable by link for reviewers, never indexed.
        ...(guide.draft ? { robots: { index: false, follow: true } } : {}),
    };
}

/** One section guide. The page follows the visitor's stored language for its chrome; the prose is English. */
export async function GuidePage({ slug }: { slug: string }) {
    const guide = await getGuide(slug);
    if (!guide) notFound();

    const { body, content, ...meta } = guide;

    return (
        <BlogLayout>
            <JsonLd nodes={[guideArticleJsonLd(meta), guideBreadcrumbJsonLd(meta)]} />
            <article className="mx-auto max-w-6xl">
                {meta.draft ? (
                    <p
                        role="note"
                        data-testid="guide-draft-notice"
                        className="mb-8 rounded-2xl border border-warning-tint2 bg-warning-tint px-4 py-3 text-sm leading-6 text-strong"
                    >
                        {GUIDE_COPY.draftNotice}
                    </p>
                ) : null}
                <GuideLanguageNotice />
                <PostHeader post={meta} indexHref={GUIDES_PATH} breadcrumbLabel={GUIDE_COPY.breadcrumb} />
                <div className="mt-10 grid gap-10 md:grid-cols-[minmax(0,1fr)_17rem] md:items-start md:gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_19rem] xl:gap-12">
                    <div className="min-w-0">
                        <PostContent body={body} content={content} enabledAdSlots={meta.adSlots} />
                        <GuideFaq faq={meta.faq} />
                        <RelatedLinks currentSlug={meta.slug} />
                        <div className="mt-10">
                            <CTA />
                        </div>
                    </div>
                    <PostSidebar post={meta} />
                </div>
            </article>
        </BlogLayout>
    );
}
