import type { Metadata } from "next";
import { IndexGuide } from "@/components/seo/IndexGuide";
import { GalleryPage } from "@/components/templates/gallery/GalleryPage";
import { TemplateGallery } from "@/components/templates/gallery/TemplateGallery";
import { galleryMetadata } from "@/lib/gallery-metadata";
import { getGalleryTemplates } from "@/lib/templates/gallery";

export const metadata: Metadata = galleryMetadata("en");

export default function TemplateGalleryPage() {
    return (
        <GalleryPage locale="en">
            <TemplateGallery entries={getGalleryTemplates()} />
            <IndexGuide locale="en" id="templates" />
        </GalleryPage>
    );
}
