import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GalleryPage } from "@/components/templates/gallery/GalleryPage";
import { JsonLd } from "@/components/seo/JsonLd";
import { TemplateDetail } from "@/components/templates/gallery/TemplateDetail";
import { galleryTemplateMetadata } from "@/lib/gallery-metadata";
import { isPrefixedLocale } from "@/lib/i18n/locales";
import { galleryTemplateBreadcrumbJsonLd } from "@/lib/structured-data";
import { getGalleryTemplate, getGalleryTemplates, relatedGalleryTemplates } from "@/lib/templates/gallery";

export const dynamicParams = false;

export function generateStaticParams() {
    return getGalleryTemplates().map(({ slug }) => ({ slug }));
}

type Params = Promise<{ lang: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { lang, slug } = await params;
    const entry = getGalleryTemplate(slug);
    return entry && isPrefixedLocale(lang) ? galleryTemplateMetadata(lang, entry) : {};
}

export default async function LocalizedTemplateGalleryDetailPage({ params }: { params: Params }) {
    const { lang, slug } = await params;
    const entry = getGalleryTemplate(slug);
    if (!entry || !isPrefixedLocale(lang)) notFound();
    return (
        <GalleryPage locale={lang}>
            <JsonLd nodes={[galleryTemplateBreadcrumbJsonLd(lang, entry)]} />
            <TemplateDetail entry={entry} related={relatedGalleryTemplates(entry.slug)} />
        </GalleryPage>
    );
}
