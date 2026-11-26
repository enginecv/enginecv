import { nextAction } from "./selectors";
import type { ApplicationStage, JobApplication } from "./schema";

/**
 * A summary spreadsheet of tracked jobs. It is for reading, not for restoring: the complete backup is the
 * JSON file. Cells that a spreadsheet would run as a formula are defused, and every cell is quoted.
 */

export interface CsvLabels {
    headers: {
        company: string; role: string; jobUrl: string; stage: string; location: string; deadline: string;
        lastSent: string; nextAction: string; cv: string; letter: string; tags: string; archived: string; created: string; updated: string;
    };
    stage: (stage: ApplicationStage) => string;
    yes: string;
}

/** A cell starting with = + - @ or a control character is prefixed with ' so spreadsheets show it as text. */
export function csvCell(value: string): string {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, "\"\"")}"`;
}

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function buildCsv(
    applications: readonly JobApplication[],
    labels: CsvLabels,
    titles: { cv: (id: string) => string | null; letter: (id: string) => string | null },
    today: string,
): string {
    const h = labels.headers;
    const header = [h.company, h.role, h.jobUrl, h.stage, h.location, h.deadline, h.lastSent, h.nextAction, h.cv, h.letter, h.tags, h.archived, h.created, h.updated];
    const rows = applications
        .filter((application) => application.trashedAt === null)
        .map((application) => {
            const next = nextAction(application, today);
            const lastSent = application.submissions.reduce<string>((latest, submission) => (submission.sentOn > latest ? submission.sentOn : latest), "");
            return [
                application.company,
                application.role,
                application.jobUrl ?? "",
                labels.stage(application.stage),
                application.location ?? "",
                application.deadline ?? "",
                lastSent,
                next ? (next.kind === "task" ? [next.task.title, next.task.dueOn].filter(Boolean).join(" · ") : `${next.interview.label} · ${new Date(next.interview.startsAt!).toISOString()}`) : "",
                application.workingCvId ? titles.cv(application.workingCvId) ?? "" : "",
                application.workingLetterId ? titles.letter(application.workingLetterId) ?? "" : "",
                application.tags.join(", "),
                application.archivedAt !== null ? labels.yes : "",
                isoDay(application.createdAt),
                isoDay(application.updatedAt),
            ];
        });
    // A byte-order mark so spreadsheet programs read the file as UTF-8.
    return `﻿${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function csvFileName(now: Date = new Date()): string {
    return `enginecv-job-tracker-${now.toISOString().slice(0, 10)}.csv`;
}
