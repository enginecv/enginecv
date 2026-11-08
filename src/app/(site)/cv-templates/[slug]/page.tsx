import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GalleryPage } from "@/components/templates/gallery/GalleryPage";
import { JsonLd } from "@/components/seo/JsonLd";
import { TemplateDetail } from "@/components/templates/gallery/TemplateDetail";
import { galleryTemplateMetadata } from "@/lib/gallery-metadata";
import { galleryTemplateBreadcrumbJsonLd } from "@/lib/structured-data";
import { getGalleryTemplate, getGalleryTemplates, relatedGalleryTemplates } from "@/lib/templates/gallery";

export const dynamicParams = false;

export function generateStaticParams() {
    return getGalleryTemplates().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const entry = getGalleryTemplate((await params).slug);
    return entry ? galleryTemplateMetadata("en", entry) : {};
}

export default async function TemplateGalleryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const entry = getGalleryTemplate((await params).slug);
    if (!entry) notFound();
    return (
        <GalleryPage locale="en">
            <JsonLd nodes={[galleryTemplateBreadcrumbJsonLd("en", entry)]} />
            <TemplateDetail entry={entry} related={relatedGalleryTemplates(entry.slug)} />
        </GalleryPage>
    );
}
