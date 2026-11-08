import { gallerySlugForTemplate } from "./gallery";
import type { TemplateDocument } from "./template-schema";

/** Translate shipped designs at display time; user-authored metadata stays verbatim. */
export function templateDisplayMeta(template: TemplateDocument, t: (key: string) => string) {
    const slug = gallerySlugForTemplate(template.id);
    if (!slug) return template.meta;
    return {
        ...template.meta,
        name: t(`template.name.${slug}`),
        description: t(`gallery.summary.${slug}`),
        tags: template.meta.tags.map((tag) => t(`template.tag.${tag.toLowerCase().replaceAll(" ", "-")}`)),
    };
}
