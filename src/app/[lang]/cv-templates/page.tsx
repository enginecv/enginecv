import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GalleryPage } from "@/components/templates/gallery/GalleryPage";
import { TemplateGallery } from "@/components/templates/gallery/TemplateGallery";
import { galleryMetadata } from "@/lib/gallery-metadata";
import { isPrefixedLocale } from "@/lib/i18n/locales";
import { getGalleryTemplates } from "@/lib/templates/gallery";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
    const { lang } = await params;
    return isPrefixedLocale(lang) ? galleryMetadata(lang) : {};
}

export default async function LocalizedTemplateGalleryPage({ params }: { params: Promise<{ lang: string }> }) {
    const { lang } = await params;
    if (!isPrefixedLocale(lang)) notFound();
    return (
        <GalleryPage locale={lang}>
            <TemplateGallery entries={getGalleryTemplates()} />
        </GalleryPage>
    );
}
