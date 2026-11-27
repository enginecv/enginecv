import { buildCalendar, calendarFileName } from "@/lib/jobs/calendar";
import type { ApplicationInterview, JobApplication } from "@/lib/jobs/schema";

/** Saves an .ics file locally. No calendar account, permission or network request is involved. */
export async function downloadCalendar(entries: { application: JobApplication; interview: ApplicationInterview }[], single: JobApplication | null): Promise<void> {
    const { downloadBlob } = await import("@/lib/export");
    downloadBlob(new Blob([buildCalendar(entries)], { type: "text/calendar;charset=utf-8" }), calendarFileName(single));
}
