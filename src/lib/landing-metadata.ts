import type { Metadata } from "next";
import { OG_LOCALES, localeAlternates, localizedPath, type Locale } from "@/lib/i18n/locales";
import { translate } from "@/lib/i18n/translate";
import { pageMetadata } from "@/lib/site";


/** Title, description, canonical and hreflang for the landing page in one locale. */
export function landingMetadata(locale: Locale): Metadata {
    return pageMetadata({
        title: translate(locale, "meta.landingTitle"),
        description: translate(locale, "meta.landingDescription"),
        path: localizedPath("/", locale),
        ogLocale: OG_LOCALES[locale],
        languages: localeAlternates("/"),
    });
}
