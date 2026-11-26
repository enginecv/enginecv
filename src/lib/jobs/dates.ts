/**
 * Date-only values (`YYYY-MM-DD`) follow the viewer's own calendar: "today" is the local date, and a stored
 * date is shown as written, never shifted by a time zone.
 */

export function localDateOnly(date: Date = new Date()): string {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A formatter for date-only values: read as UTC midnight and printed in UTC, so the day never moves. */
export function dateOnlyFormatter(locale: string): (value: string) => string {
    const format = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
    return (value) => format.format(Date.parse(`${value}T00:00:00Z`));
}
