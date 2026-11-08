import { DEFAULT_LOCALE, localizedPath, type Locale } from "@/lib/i18n/locales";
import {
    ROLE_EXAMPLES,
    ROLE_EXAMPLE_LOCALES,
    ROLE_FIELDS,
    type RoleExample,
    type RoleExampleLocale,
    type RoleExampleVersion,
    type RoleField,
} from "./registry";

/*
 * Pure rules for role example pages: which versions are public and where
 * search engines and the language switcher should point. Sitemap, index,
 * metadata and language links all read from here, so flipping one `status`
 * changes every surface together.
 */

export const ROLE_EXAMPLES_PATH = "/cv-examples";

/** A role's version in one language, with the role it belongs to. */
export interface RoleExampleEntry {
    role: RoleExample;
    locale: RoleExampleLocale;
    version: RoleExampleVersion;
}

export function roleExamplePath(locale: Locale, slug?: string): string {
    return localizedPath(slug ? `${ROLE_EXAMPLES_PATH}/${slug}` : ROLE_EXAMPLES_PATH, locale);
}

export function entryPath(entry: RoleExampleEntry): string {
    return roleExamplePath(entry.locale, entry.version.slug);
}

export function entriesFor(roles: readonly RoleExample[] = ROLE_EXAMPLES): RoleExampleEntry[] {
    return roles.flatMap((role) => ROLE_EXAMPLE_LOCALES.flatMap((locale) => {
        const version = role.versions[locale];
        return version ? [{ role, locale, version }] : [];
    }));
}

export function publishedEntries(roles: readonly RoleExample[] = ROLE_EXAMPLES): RoleExampleEntry[] {
    return entriesFor(roles).filter((entry) => entry.version.status === "published");
}

export function findEntry(locale: string, slug: string, roles: readonly RoleExample[] = ROLE_EXAMPLES): RoleExampleEntry | undefined {
    return entriesFor(roles).find((entry) => entry.locale === locale && entry.version.slug === slug);
}

/** Languages whose index has at least one published role; an index is never empty. */
export function indexLocales(roles: readonly RoleExample[] = ROLE_EXAMPLES): RoleExampleLocale[] {
    const published = publishedEntries(roles);
    return ROLE_EXAMPLE_LOCALES.filter((locale) => published.some((entry) => entry.locale === locale));
}

/**
 * hreflang map for a role: its published versions plus x-default (English when
 * published, else the first published one). Empty with fewer than two published
 * versions, since a lone page needs only its canonical.
 */
export function exampleAlternates(role: RoleExample): Record<string, string> {
    const published = publishedEntries([role]);
    if (published.length < 2) return {};
    const fallback = published.find((entry) => entry.locale === DEFAULT_LOCALE) ?? published[0];
    return {
        ...Object.fromEntries(published.map((entry) => [entry.locale, entryPath(entry)])),
        "x-default": entryPath(fallback),
    };
}

/** hreflang map for the index pages of the languages that have one. */
export function indexAlternates(roles: readonly RoleExample[] = ROLE_EXAMPLES): Record<string, string> {
    const locales = indexLocales(roles);
    if (locales.length < 2) return {};
    const fallback = locales.find((locale) => locale === DEFAULT_LOCALE) ?? locales[0];
    return {
        ...Object.fromEntries(locales.map((locale) => [locale, roleExamplePath(locale)])),
        "x-default": roleExamplePath(fallback),
    };
}

export interface IndexGroup {
    field: RoleField;
    entries: RoleExampleEntry[];
}

/** Published entries of one language grouped by field, in registry order, empty groups dropped. */
export function indexGroups(locale: RoleExampleLocale, roles: readonly RoleExample[] = ROLE_EXAMPLES): IndexGroup[] {
    const entries = publishedEntries(roles).filter((entry) => entry.locale === locale);
    return ROLE_FIELDS
        .map((field) => ({ field, entries: entries.filter((entry) => entry.role.field === field) }))
        .filter((group) => group.entries.length > 0);
}

/**
 * Language switcher targets for one page. Only published siblings are offered;
 * every other language falls back to its index when it has one, else to the
 * current page, so the switcher never lands on a 404 or a draft.
 */
export function languageLinks(entry: RoleExampleEntry, roles: readonly RoleExample[] = ROLE_EXAMPLES): Record<Locale, string> {
    const own = entryPath(entry);
    const published = publishedEntries([entry.role]);
    const withIndex = indexLocales(roles);
    const link = (locale: Locale): string => {
        const sibling = published.find((candidate) => candidate.locale === locale);
        if (sibling) return entryPath(sibling);
        if (locale === entry.locale) return own;
        return withIndex.includes(locale as RoleExampleLocale) ? roleExamplePath(locale) : own;
    };
    return { en: link("en"), de: link("de"), bs: link("bs"), fr: link("fr"), es: link("es") };
}

/** Slugs to prerender for one language: every version, drafts included, since drafts are reachable by URL.
 */
export function staticSlugs(locale: RoleExampleLocale, roles: readonly RoleExample[] = ROLE_EXAMPLES): Array<{ slug: string }> {
    return entriesFor(roles).filter((entry) => entry.locale === locale).map((entry) => ({ slug: entry.version.slug }));
}

/**
 * Language switcher targets for the index: each language that has an index goes to it,
 * every other language stays on this one.
 */
export function indexLanguageLinks(current: Locale, roles: readonly RoleExample[] = ROLE_EXAMPLES): Record<Locale, string> {
    const withIndex = indexLocales(roles) as Locale[];
    const link = (locale: Locale) => (withIndex.includes(locale) ? roleExamplePath(locale) : roleExamplePath(current));
    return { en: link("en"), de: link("de"), bs: link("bs"), fr: link("fr"), es: link("es") };
}
