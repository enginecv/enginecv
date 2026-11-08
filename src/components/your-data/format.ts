import type { Locale } from "@/lib/i18n";

export function formatBytes(bytes: number, locale: Locale): string {
    const units = ["byte", "kilobyte", "megabyte"] as const;
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return new Intl.NumberFormat(locale, {
        style: "unit",
        unit: units[unit],
        unitDisplay: "short",
        maximumFractionDigits: unit === 0 ? 0 : 1,
    }).format(value);
}

export function formatDateTime(iso: string, locale: Locale): string {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
