import { parseHumanDate, STORED_PRESENT } from "@/lib/agent/authoring/values";

const ISO_DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

export interface ImportedDate {
    /** EngineCV date: `YYYY` or `YYYY-MM`, or "" when the input has none. */
    value: string;
    /** True when a day of the month was dropped. */
    dayDropped: boolean;
    /** True when the input was non-empty but could not be read. */
    unreadable: boolean;
}

/** JSON Resume date (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`) to the stored form. */
export function importDate(raw: unknown): ImportedDate {
    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) return { value: "", dayDropped: false, unreadable: false };
    const match = ISO_DATE.exec(text);
    if (match) {
        const [, year, month, day] = match;
        if (month && (Number(month) < 1 || Number(month) > 12)) return { value: year, dayDropped: false, unreadable: false };
        return { value: month ? `${year}-${month}` : year, dayDropped: Boolean(day), unreadable: false };
    }
    const parsed = parseHumanDate(text);
    if (parsed.issue?.code === "date-unparsed" || !parsed.value) return { value: "", dayDropped: false, unreadable: true };
    return { value: parsed.value, dayDropped: false, unreadable: false };
}

export interface ExportedDate {
    /** JSON Resume date, or undefined when there is nothing to write. */
    value: string | undefined;
    /** True when the stored value was present but could not be written. */
    unparsed: boolean;
    /** True when the stored value means "current". */
    current: boolean;
}

/** Stored date to JSON Resume (`YYYY` or `YYYY-MM`); "Present" means no date. */
export function exportDate(stored: string | undefined): ExportedDate {
    const text = (stored ?? "").trim();
    if (!text) return { value: undefined, unparsed: false, current: false };
    if (text === STORED_PRESENT) return { value: undefined, unparsed: false, current: true };
    const iso = ISO_DATE.exec(text);
    if (iso) return { value: iso[2] ? `${iso[1]}-${iso[2]}` : iso[1], unparsed: false, current: false };
    const parsed = parseHumanDate(text);
    if (parsed.value === STORED_PRESENT) return { value: undefined, unparsed: false, current: true };
    const reparsed = ISO_DATE.exec(parsed.value);
    if (reparsed && !parsed.issue?.code?.startsWith("date-unparsed")) {
        return { value: reparsed[2] ? `${reparsed[1]}-${reparsed[2]}` : reparsed[1], unparsed: false, current: false };
    }
    return { value: undefined, unparsed: true, current: false };
}
