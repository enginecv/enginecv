import { getBuiltinTemplateById, getTemplatePreviewOptions } from "./enginecv-templates";
import type { TemplateDocument } from "./template-schema";

/** Base path of the public template gallery; locale URLs prefix it ("/de/cv-templates"). */
export const GALLERY_PATH = "/cv-templates";

// Public slug for each built-in template, in gallery order. Slugs are part of
// indexed URLs: never rename one without a redirect.
const GALLERY_SLUGS = [
    ["modern", "enginecv-modern"],
    ["ats-plain", "enginecv-compact"],
    ["sidebar", "enginecv-sidebar"],
    ["photo-header", "enginecv-photo-header"],
    ["lebenslauf", "enginecv-lebenslauf"],
    ["timeline", "enginecv-timeline"],
    ["executive", "enginecv-executive"],
    ["developer", "enginecv-developer"],
] as const;

export type GallerySlug = (typeof GALLERY_SLUGS)[number][0];

export function gallerySlugForTemplate(templateId: string): GallerySlug | undefined {
    return GALLERY_SLUGS.find(([, id]) => id === templateId)?.[0];
}

export type GalleryTemplate = {
    slug: GallerySlug;
    template: TemplateDocument;
    columns: "one" | "two";
    photo: boolean;
};

export function getGalleryTemplates(): GalleryTemplate[] {
    return GALLERY_SLUGS.map(([slug, id]) => {
        const template = getBuiltinTemplateById(id);
        if (!template) throw new Error(`Gallery template ${id} is not a built-in template.`);
        return {
            slug,
            template,
            columns: template.settings.layout.columns === "two" ? "two" : "one",
            photo: Boolean(getTemplatePreviewOptions(id).photo),
        };
    });
}

export function getGalleryTemplate(slug: string): GalleryTemplate | undefined {
    return getGalleryTemplates().find((entry) => entry.slug === slug);
}

export function galleryTemplatePath(slug: GallerySlug): string {
    return `${GALLERY_PATH}/${slug}`;
}

/** Up to `count` other templates, starting after this one so each page links onward. */
export function relatedGalleryTemplates(slug: GallerySlug, count = 3): GalleryTemplate[] {
    const all = getGalleryTemplates();
    const index = all.findIndex((entry) => entry.slug === slug);
    return Array.from({ length: Math.min(count, all.length - 1) }, (_, i) => all[(index + 1 + i) % all.length]);
}
