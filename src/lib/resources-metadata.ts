import type { Metadata } from "next";
import { OG_LOCALES, localeAlternates, localizedPath, type Locale } from "@/lib/i18n/locales";
import { translate } from "@/lib/i18n/translate";
import { RESOURCES_PATH } from "@/lib/resources";
import { pageMetadata } from "@/lib/site";

/** Title, description, canonical and hreflang for the resources page in one locale. */
export function resourcesMetadata(locale: Locale): Metadata {
    return pageMetadata({
        title: translate(locale, "resources.metaTitle"),
        description: translate(locale, "resources.metaDescription"),
        path: localizedPath(RESOURCES_PATH, locale),
        ogLocale: OG_LOCALES[locale],
        languages: localeAlternates(RESOURCES_PATH),
    });
}
