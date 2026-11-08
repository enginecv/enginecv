// LinkedIn exports dates with English month abbreviations regardless of the
// member's UI language, so a fixed 12-entry map is the whole vocabulary.
const MONTHS: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
};

/**
 * Normalize a LinkedIn export date to the resume date vocabulary:
 * "MMM yyyy" → "YYYY-MM", "yyyy" → "YYYY", "yyyy-MM-dd" → "YYYY-MM",
 * anything else (including empty) → "". Total: never throws.
 */
export function parseLinkedinDate(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return "";

    const monthYear = /^([A-Za-z]{3}) (\d{4})$/.exec(trimmed);
    if (monthYear) {
        const month = MONTHS[monthYear[1].toLowerCase()];
        return month ? `${monthYear[2]}-${month}` : "";
    }

    if (/^\d{4}$/.test(trimmed)) return trimmed;

    const isoDate = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(trimmed);
    if (isoDate) return `${isoDate[1]}-${isoDate[2]}`;

    return "";
}
