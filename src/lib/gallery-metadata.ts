import type { Metadata } from "next";
import { OG_LOCALES, localeAlternates, localizedPath, type Locale } from "@/lib/i18n/locales";
import { translate } from "@/lib/i18n/translate";
import { pageMetadata } from "@/lib/site";
import { GALLERY_PATH, galleryTemplatePath, type GalleryTemplate } from "@/lib/templates/gallery";


function interpolate(text: string, params: Record<string, string>) {
    return Object.entries(params).reduce((out, [key, value]) => out.replace(`{${key}}`, value), text);
}

export function galleryMetadata(locale: Locale): Metadata {
    return pageMetadata({
        title: translate(locale, "gallery.metaTitle"),
        description: translate(locale, "gallery.intro"),
        path: localizedPath(GALLERY_PATH, locale),
        ogLocale: OG_LOCALES[locale],
        languages: localeAlternates(GALLERY_PATH),
    });
}

export function galleryTemplateMetadata(locale: Locale, entry: GalleryTemplate): Metadata {
    const name = entry.template.meta.name;
    const path = galleryTemplatePath(entry.slug);
    const base = pageMetadata({
        title: interpolate(translate(locale, "gallery.detailMetaTitle"), { name }),
        description: `${translate(locale, `gallery.summary.${entry.slug}`)} ${translate(locale, "gallery.factFree")}.`,
        path: localizedPath(path, locale),
        ogLocale: OG_LOCALES[locale],
        languages: localeAlternates(path),
    });
    // The template's own preview is the share card.
    const image = {
        url: `/template-previews/${entry.template.id}.png`,
        width: 1588,
        height: 2246,
        alt: interpolate(translate(locale, "gallery.previewAlt"), { name }),
    };
    return { ...base, openGraph: { ...base.openGraph, images: [image] } };
}
