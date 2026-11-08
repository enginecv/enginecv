import type { Locale } from "@/lib/i18n";

const blogDateLocales: Record<Locale, string> = {
    en: "en-US",
    bs: "bs-BA",
    de: "de-DE",
    fr: "fr-FR",
    es: "es-ES",
};

function parseBlogDate(date: string) {
    const [year, month, day] = date.split("-").map((segment) => Number(segment));
    return new Date(Date.UTC(year, month - 1, day));
}

export function formatBlogDate(date: string, locale: Locale = "en") {
    return new Intl.DateTimeFormat(blogDateLocales[locale], {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    }).format(parseBlogDate(date));
}
