// Locale routing shared by server layouts, the sitemap and client navigation.
// English lives at the unprefixed path ("/"); the others at "/de", "/bs", ...

export type Locale = "en" | "bs" | "de" | "fr" | "es";

export const DEFAULT_LOCALE: Locale = "en";

/** Locales served under a URL prefix, in hreflang order. */
export const PREFIXED_LOCALES = ["de", "bs", "fr", "es"] as const satisfies readonly Locale[];

export type PrefixedLocale = (typeof PREFIXED_LOCALES)[number];

export function isPrefixedLocale(value: string): value is PrefixedLocale {
  return (PREFIXED_LOCALES as readonly string[]).includes(value);
}

/** "/" in German is "/de"; "/blog" in German would be "/de/blog". */
export function localizedPath(path: string, locale: Locale): string {
  if (locale === DEFAULT_LOCALE) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** URL languages own public documents; shared pages and the app follow the saved preference. */
export function documentLocale(pathname: string, storedLocale: Locale): Locale {
  const firstSegment = pathname.split("/")[1] ?? "";
  if (isPrefixedLocale(firstSegment)) return firstSegment;
  if (pathname === "/" || ["blog", "cv-templates", "cv-examples", "tools"].includes(firstSegment)) return DEFAULT_LOCALE;
  return storedLocale;
}

/** hreflang alternates for a localized path, including x-default. */
export function localeAlternates(path: string): Record<string, string> {
  return {
    en: path,
    ...Object.fromEntries(PREFIXED_LOCALES.map((locale) => [locale, localizedPath(path, locale)])),
    "x-default": path,
  };
}

/** Open Graph locale per app locale. */
export const OG_LOCALES: Record<Locale, string> = {
  en: "en",
  de: "de_DE",
  bs: "bs_BA",
  fr: "fr_FR",
  es: "es_ES",
};
