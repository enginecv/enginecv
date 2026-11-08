import type { GallerySlug } from "../gallery";

/**
 * Long-form English text for one template page. It sits beside the translated
 * summary, "who it suits" and facts (which stay in the translation files) and is
 * shown on the English page only, so it is not part of the locale-parity set.
 * Every statement about layout must match the template's settings in
 * `enginecv-templates.ts`.
 */
export interface TemplateProse {
    slug: GallerySlug;
    /** What the template is and the kind of CV it produces, as paragraphs. */
    overview: string[];
    /** How the page is actually built: fonts, columns, photo, ordering. */
    build: string[];
    /** Practical advice for filling it in. */
    tips: string[];
    /** Honest cases where a different template is the better pick. */
    alternatives: string[];
}
