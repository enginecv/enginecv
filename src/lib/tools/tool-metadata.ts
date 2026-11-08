import type { Metadata } from "next";
import { OG_LOCALES, localeAlternates, localizedPath, type Locale } from "@/lib/i18n/locales";
import { translate } from "@/lib/i18n/translate";
import { pageMetadata } from "@/lib/site";
import { TOOLS_PATH, toolPath, type ToolDefinition } from "@/lib/tools/registry";

/** Title, description, canonical and hreflang for the tools index in one locale. */
export function toolsIndexMetadata(locale: Locale): Metadata {
    return pageMetadata({
        title: translate(locale, "tools.index.metaTitle"),
        description: translate(locale, "tools.index.metaDescription"),
        path: localizedPath(TOOLS_PATH, locale),
        ogLocale: OG_LOCALES[locale],
        languages: localeAlternates(TOOLS_PATH),
    });
}

/** Title, description, canonical and hreflang for one tool page in one locale. */
export function toolMetadata(locale: Locale, tool: ToolDefinition): Metadata {
    const path = toolPath(tool.slug);
    return pageMetadata({
        title: translate(locale, `${tool.keyPrefix}.metaTitle`),
        description: translate(locale, `${tool.keyPrefix}.metaDescription`),
        path: localizedPath(path, locale),
        ogLocale: OG_LOCALES[locale],
        languages: localeAlternates(path),
    });
}
