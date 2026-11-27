import { applicationFileText, parseApplicationText } from "@/lib/jobs/file-format";
import { jobApplicationSchema, type ApplicationSubmission, type JobApplication } from "@/lib/jobs/schema";
import type { PendingReview } from "../types";
import type { DocumentCodec, ParseOutcome } from "./types";

/**
 * How a tracked job is read from and written to its workspace file. The file carries the whole record,
 * so an apply replaces the record, with three protections:
 * - recorded copies are immutable: a submission's packet id and hash, and its captured selections,
 *   always come from this browser's record (an edited file cannot point a submission at other evidence);
 * - the local revision counter moves forward, so an open job sheet sees the change as a conflict;
 * - removals of history (submissions, tasks, interviews, contacts, timeline events) and emptied notes wait
 *   for the person's review instead of applying (see `applicationGuard`).
 * Contact details are part of the tracker's data; the folder option that leaves CV contact details out
 * does not apply to them (the person is told when they turn the tracker on).
 */

const INCOMING_ID = "incoming";

/** Keeps every submission this browser already has exactly as recorded; only new ones come from the file. */
function protectEvidence(current: JobApplication, incoming: JobApplication): JobApplication {
    const known = new Map(current.submissions.map((submission) => [submission.id, submission]));
    const submissions = incoming.submissions.map((submission): ApplicationSubmission => {
        const recorded = known.get(submission.id);
        if (!recorded) return submission;
        return { ...submission, cv: recorded.cv, letter: recorded.letter, packetId: recorded.packetId, packetSha256: recorded.packetSha256, recordedAt: recorded.recordedAt };
    });
    return { ...incoming, submissions };
}

export function createApplicationCodec(): DocumentCodec<JobApplication> {
    const codec: DocumentCodec<JobApplication> = {
        kind: "application",

        parse(text): ParseOutcome<JobApplication> {
            const parsed = parseApplicationText(text);
            if (!parsed.ok) return parsed;
            return { ok: true, doc: { ...parsed.application, id: parsed.id ?? INCOMING_ID, revision: 1 }, id: parsed.id, notices: [] };
        },

        apply(current, incoming) {
            const next = protectEvidence(current, { ...incoming, id: current.id });
            return jobApplicationSchema.parse({ ...next, revision: current.revision + 1, updatedAt: Math.max(next.updatedAt, current.updatedAt + 1) });
        },

        serialize: (doc) => applicationFileText(doc),
        updatedAt: (doc) => doc.updatedAt,
        entryCount: (doc) => doc.submissions.length + doc.tasks.length + doc.interviews.length + doc.contacts.length + doc.events.length,
        canApplyExternal: () => ({ ok: true }),

        describeChange(before, after) {
            let added = 0;
            let removed = 0;
            let changed = 0;
            for (const key of ["submissions", "tasks", "interviews", "contacts", "events"] as const) {
                const a = new Map<string, string>(before[key].map((item: { id: string }) => [item.id, JSON.stringify(item)]));
                const b = new Map<string, string>(after[key].map((item: { id: string }) => [item.id, JSON.stringify(item)]));
                for (const [id, value] of b) {
                    if (!a.has(id)) added += 1;
                    else if (a.get(id) !== value) changed += 1;
                }
                for (const id of a.keys()) if (!b.has(id)) removed += 1;
            }
            const strip = (application: JobApplication) => JSON.stringify({ ...application, submissions: 0, tasks: 0, interviews: 0, contacts: 0, events: 0, revision: 0, updatedAt: 0 });
            return { added, removed, changed: changed + (strip(before) === strip(after) ? 0 : 1) };
        },

        // The revision is this browser's counter, not content.
        isSameContent: (a, b) => applicationFileText(a) === applicationFileText(b),
    };
    return codec;
}

/** Timeline events that may disappear in one change before it is held for review (an agent tidying up). */
const EVENT_REMOVAL_ALLOWANCE = 2;

/**
 * Holds a job file change for review when it would remove recorded history: any submission, task,
 * interview or contact, more than a couple of timeline events, or notes that had text. The review dialog
 * lists what would go (in the app only; logs carry counts).
 */
export function applicationGuard(before: JobApplication, after: JobApplication, now: number): PendingReview | null {
    const removedFrom = <T extends { id: string }>(list: (application: JobApplication) => T[]) => {
        const kept = new Set(list(after).map((item) => item.id));
        return list(before).filter((item) => !kept.has(item.id));
    };
    const submissions = removedFrom((application) => application.submissions);
    const tasks = removedFrom((application) => application.tasks);
    const interviews = removedFrom((application) => application.interviews);
    const contacts = removedFrom((application) => application.contacts);
    const events = removedFrom((application) => application.events);
    const notesEmptied = before.notesMarkdown.trim() !== "" && after.notesMarkdown.trim() === "";
    const removedTitles = [
        ...submissions.map((item) => `↗ ${item.sentOn}`),
        ...tasks.map((item) => item.title),
        ...interviews.map((item) => item.label),
        ...contacts.map((item) => item.name),
    ];
    const removedCount = submissions.length + tasks.length + interviews.length + contacts.length + events.length;
    if (removedTitles.length === 0 && events.length <= EVENT_REMOVAL_ALLOWANCE && !notesEmptied) return null;
    const previousCount = before.submissions.length + before.tasks.length + before.interviews.length + before.contacts.length + before.events.length;
    return {
        removed: [...removedTitles.slice(0, 10), ...(notesEmptied ? ["—"] : [])],
        keptCount: previousCount - removedCount,
        previousCount,
        at: now,
    };
}
