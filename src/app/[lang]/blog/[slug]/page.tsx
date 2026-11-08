import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogPostPage, blogPostMetadata } from "@/components/blog/BlogPostPage";
import { getBlogStaticParams } from "@/lib/blog";
import { isPrefixedLocale } from "@/lib/i18n/locales";

// Only posts written in this language exist here; no fallback to another language.
export const dynamicParams = false;

// Full { lang, slug } pairs, not filtered by the parent `lang`: Next passes a parent
// through without a slug when a child returns nothing for it (French has no posts),
// which drops every path of this route. The pairs override the parent's lang.
export async function generateStaticParams() {
    return getBlogStaticParams();
}

type Params = Promise<{ lang: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { lang, slug } = await params;
    return isPrefixedLocale(lang) ? blogPostMetadata(lang, slug) : {};
}

export default async function LocalizedBlogPostPage({ params }: { params: Params }) {
    const { lang, slug } = await params;
    if (!isPrefixedLocale(lang)) notFound();
    return <BlogPostPage locale={lang} slug={slug} />;
}
