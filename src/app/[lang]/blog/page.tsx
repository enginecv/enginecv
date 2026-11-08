import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogIndexPage, blogIndexMetadata } from "@/components/blog/BlogIndexPage";
import { PREFIXED_LOCALES, isPrefixedLocale } from "@/lib/i18n/locales";

export const dynamicParams = false;

// Empty indexes keep the selected language and remain noindex until publication.
export function generateStaticParams() {
    return PREFIXED_LOCALES.map((lang) => ({ lang }));
}

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { lang } = await params;
    return isPrefixedLocale(lang) ? blogIndexMetadata(lang) : {};
}

export default async function LocalizedBlogIndexPage({ params }: { params: Params }) {
    const { lang } = await params;
    if (!isPrefixedLocale(lang)) notFound();
    return <BlogIndexPage locale={lang} />;
}
