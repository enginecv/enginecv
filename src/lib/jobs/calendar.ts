import { isSafeWebUrl, type ApplicationInterview, type JobApplication } from "./schema";

/**
 * A local iCalendar (RFC 5545) file for scheduled interviews, downloaded by the person and imported into
 * any calendar. No calendar account or permission is involved, and nothing is delivered: importing it
 * again updates the same events (stable UID, rising SEQUENCE), and a cancelled round is sent as CANCELLED.
 */

const PRODUCT = "-//EngineCV//Job Tracker//EN";

/** Escapes TEXT values: backslash, semicolon, comma and newlines. */
export function escapeText(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

/** Folds a content line at 75 octets, never splitting a UTF-8 character. */
export function foldLine(line: string): string {
    const encoder = new TextEncoder();
    const out: string[] = [];
    let current = "";
    let size = 0;
    for (const char of line) {
        const bytes = encoder.encode(char).length;
        const limit = out.length === 0 ? 75 : 74; // continuation lines start with a space
        if (size + bytes > limit) {
            out.push(current);
            current = "";
            size = 0;
        }
        current += char;
        size += bytes;
    }
    out.push(current);
    return out.join("\r\n ");
}

function utcStamp(instant: number): string {
    return new Date(instant).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

const DEFAULT_LENGTH_MS = 60 * 60 * 1000;

function eventLines(application: JobApplication, interview: ApplicationInterview, now: number): string[] {
    const start = interview.startsAt!;
    const end = interview.endsAt ?? start + DEFAULT_LENGTH_MS;
    const contacts = interview.contactIds
        .map((id) => application.contacts.find((contact) => contact.id === id))
        .filter((contact): contact is NonNullable<typeof contact> => Boolean(contact))
        .map((contact) => [contact.name, contact.role].filter(Boolean).join(", "));
    const description = [
        `${application.role} · ${application.company}`,
        contacts.length > 0 ? contacts.join("\n") : null,
        interview.notes.trim() || null,
    ].filter(Boolean).join("\n\n");
    const lines = [
        "BEGIN:VEVENT",
        `UID:${interview.id}@jobs.enginecv.app`,
        `DTSTAMP:${utcStamp(now)}`,
        `DTSTART:${utcStamp(start)}`,
        `DTEND:${utcStamp(end)}`,
        // Seconds since the round was last changed: always rises when it is edited and exported again.
        `SEQUENCE:${Math.floor(interview.updatedAt / 1000)}`,
        `STATUS:${interview.outcome === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
        `SUMMARY:${escapeText(`${interview.label} – ${application.company}`)}`,
        `DESCRIPTION:${escapeText(description)}`,
    ];
    if (interview.location) lines.push(`LOCATION:${escapeText(interview.location)}`);
    if (interview.link && isSafeWebUrl(interview.link)) lines.push(`URL:${interview.link}`);
    lines.push("END:VEVENT");
    return lines;
}

/** Rounds with a start time that are scheduled, or cancelled (so a calendar can drop an earlier import). */
export function exportableInterviews(application: JobApplication): ApplicationInterview[] {
    return application.interviews.filter((interview) => interview.startsAt !== null && interview.outcome !== "completed");
}

export function buildCalendar(entries: readonly { application: JobApplication; interview: ApplicationInterview }[], now: number = Date.now()): string {
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:${PRODUCT}`, "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
    for (const { application, interview } of entries) {
        if (interview.startsAt === null) continue;
        lines.push(...eventLines(application, interview, now));
    }
    lines.push("END:VCALENDAR");
    return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

export function calendarFileName(application: JobApplication | null, now: Date = new Date()): string {
    const slug = application
        ? application.company.toLocaleLowerCase().normalize("NFKD").replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "interviews"
        : "interviews";
    return `enginecv-${slug}-${now.toISOString().slice(0, 10)}.ics`;
}
