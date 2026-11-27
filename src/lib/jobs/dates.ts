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

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

interface WallTime {
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(zone: string): Intl.DateTimeFormat {
    let format = partsFormatters.get(zone);
    if (!format) {
        format = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
        partsFormatters.set(zone, format);
    }
    return format;
}

/** The wall-clock date and time an instant shows in `zone`. */
export function wallTimeIn(instant: number, zone: string): WallTime {
    const parts = Object.fromEntries(partsFormatter(zone).formatToParts(instant).map((part) => [part.type, part.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

function wallAsUtc({ date, time }: WallTime): number {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    return Date.UTC(year, month - 1, day, hour, minute);
}

/** The zone's offset from UTC (ms) at an instant. */
function offsetAt(instant: number, zone: string): number {
    return wallAsUtc(wallTimeIn(instant, zone)) - Math.floor(instant / MINUTE) * MINUTE;
}

export type ZonedInstant =
    | { status: "ok"; instant: number }
    /** The clock jumps over this time (spring forward): it never happens in that zone. */
    | { status: "nonexistent" }
    /** The clock passes this time twice (fall back): `instants` holds both, earlier first. */
    | { status: "ambiguous"; instants: [number, number] };

/**
 * The UTC instant of a wall-clock time in an IANA zone. Daylight-saving gaps and overlaps are reported,
 * never silently shifted, so the person can choose.
 */
export function instantFromWallTime(date: string, time: string, zone: string): ZonedInstant {
    const wall = { date, time };
    const naive = wallAsUtc(wall);
    const candidates = [...new Set([naive - offsetAt(naive - 12 * HOUR, zone), naive - offsetAt(naive + 12 * HOUR, zone)])]
        .filter((instant) => {
            const shown = wallTimeIn(instant, zone);
            return shown.date === date && shown.time === time;
        })
        .sort((a, b) => a - b);
    if (candidates.length === 0) return { status: "nonexistent" };
    if (candidates.length === 1) return { status: "ok", instant: candidates[0] };
    return { status: "ambiguous", instants: [candidates[0], candidates[1]] };
}

/** The viewer's own IANA zone, for new interviews. */
export function viewerTimeZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Every IANA zone the browser knows, for the zone picker; falls back to the viewer's zone and UTC. */
export function knownTimeZones(): string[] {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
    return [...new Set([viewerTimeZone(), "UTC", ...supported])];
}

/** Milliseconds until the viewer's next local midnight, so "today" can be recomputed then. */
export function msUntilLocalMidnight(now: Date = new Date()): number {
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return next.getTime() - now.getTime();
}
