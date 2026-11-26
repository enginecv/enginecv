import { createId } from "@/lib/id";
import type { ApplicationEvent, ApplicationStage, ApplicationSubmission, JobApplication } from "./schema";

/**
 * Pure rules for changing an application. Each returns a new aggregate with its explanatory event
 * appended, or the same object when nothing changes. They never touch the database, bump `revision` or
 * set `updatedAt`: the repository does that once, inside the write transaction.
 */

export interface OperationContext {
    now: number;
    newId: () => string;
}

export const defaultContext = (): OperationContext => ({ now: Date.now(), newId: createId });

/** The fields a person edits directly; everything else changes only through an operation. */
export type ApplicationDetails = Pick<
    JobApplication,
    | "company"
    | "role"
    | "jobUrl"
    | "source"
    | "location"
    | "workMode"
    | "employmentType"
    | "compensation"
    | "descriptionMarkdown"
    | "notesMarkdown"
    | "tags"
    | "deadline"
    | "workingCvId"
    | "workingLetterId"
>;

export type NewApplicationInput = Pick<ApplicationDetails, "company" | "role"> & Partial<ApplicationDetails>;

type EventBody = ApplicationEvent extends infer E ? (E extends ApplicationEvent ? Omit<E, "id" | "recordedAt" | "occurredOn" | "occurredAt" | "source"> : never) : never;

function event(body: EventBody, ctx: OperationContext, occurredOn: string | null = null): ApplicationEvent {
    return { id: ctx.newId(), recordedAt: ctx.now, occurredOn, occurredAt: null, source: "user", ...body } as ApplicationEvent;
}

/** Tags compared without case, so "Remote" and "remote" are one tag; the first spelling wins. */
export function normalizeTags(tags: readonly string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const raw of tags) {
        const tag = raw.trim();
        const key = tag.toLocaleLowerCase();
        if (!tag || seen.has(key)) continue;
        seen.add(key);
        result.push(tag);
    }
    return result;
}

export function newApplication(input: NewApplicationInput, ctx: OperationContext, duplicatedFrom: string | null = null): JobApplication {
    return {
        jobUrl: null,
        source: null,
        location: null,
        workMode: "unspecified",
        employmentType: null,
        compensation: null,
        descriptionMarkdown: "",
        notesMarkdown: "",
        deadline: null,
        workingCvId: null,
        workingLetterId: null,
        ...input,
        tags: normalizeTags(input.tags ?? []),
        id: ctx.newId(),
        stage: "saved",
        contacts: [],
        tasks: [],
        interviews: [],
        submissions: [],
        events: [event({ type: "created", duplicatedFrom }, ctx)],
        archivedAt: null,
        trashedAt: null,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        revision: 1,
    };
}

export function updateDetails(application: JobApplication, patch: Partial<ApplicationDetails>): JobApplication {
    const next = { ...application, ...patch, ...(patch.tags ? { tags: normalizeTags(patch.tags) } : {}) };
    const changed = (Object.keys(patch) as (keyof ApplicationDetails)[]).some(
        (key) => JSON.stringify(next[key]) !== JSON.stringify(application[key]),
    );
    return changed ? next : application;
}

/**
 * Moves to any stage, including straight to a closed one for historical records. A move alone never
 * creates a submission: "applied" without one means "details not recorded".
 */
export function changeStage(application: JobApplication, to: ApplicationStage, ctx: OperationContext, occurredOn: string | null = null): JobApplication {
    if (application.stage === to) return application;
    return {
        ...application,
        stage: to,
        events: [...application.events, event({ type: "stage-changed", from: application.stage, to }, ctx, occurredOn)],
    };
}

/**
 * Adds a recorded submission and its event. The first one moves Saved or Preparing to Applied; later
 * ones (and ones on an application already further along or closed) leave the stage alone.
 */
export function recordSubmission(application: JobApplication, submission: ApplicationSubmission, ctx: OperationContext): JobApplication {
    const moves = application.stage === "saved" || application.stage === "preparing";
    const events: ApplicationEvent[] = [event({ type: "submission-recorded", submissionId: submission.id }, ctx, submission.sentOn)];
    if (moves) events.push(event({ type: "stage-changed", from: application.stage, to: "applied" }, ctx, submission.sentOn));
    return {
        ...application,
        stage: moves ? "applied" : application.stage,
        submissions: [...application.submissions, submission],
        events: [...application.events, ...events],
    };
}

export function archive(application: JobApplication, ctx: OperationContext): JobApplication {
    if (application.archivedAt !== null) return application;
    return { ...application, archivedAt: ctx.now, events: [...application.events, event({ type: "archived" }, ctx)] };
}

export function unarchive(application: JobApplication, ctx: OperationContext): JobApplication {
    if (application.archivedAt === null) return application;
    return { ...application, archivedAt: null, events: [...application.events, event({ type: "unarchived" }, ctx)] };
}

/** Reversible: the record keeps its stage, links, tasks and evidence references while in the trash. */
export function trash(application: JobApplication, ctx: OperationContext): JobApplication {
    if (application.trashedAt !== null) return application;
    return { ...application, trashedAt: ctx.now, events: [...application.events, event({ type: "trashed" }, ctx)] };
}

export function restore(application: JobApplication, ctx: OperationContext): JobApplication {
    if (application.trashedAt === null) return application;
    return { ...application, trashedAt: null, events: [...application.events, event({ type: "restored" }, ctx)] };
}

/**
 * A fresh application for the same job (reapplying later, or a similar role): job details copied, history
 * not. Sent documents, tasks, interviews and events stay with the original, so nothing looks sent twice.
 */
export function duplicate(application: JobApplication, ctx: OperationContext, options: { keepWorkingDocuments: boolean }): JobApplication {
    const { company, role, jobUrl, source, location, workMode, employmentType, compensation, descriptionMarkdown, notesMarkdown, tags, deadline } = application;
    return newApplication(
        {
            company,
            role,
            jobUrl,
            source,
            location,
            workMode,
            employmentType,
            compensation,
            descriptionMarkdown,
            notesMarkdown,
            tags,
            deadline,
            workingCvId: options.keepWorkingDocuments ? application.workingCvId : null,
            workingLetterId: options.keepWorkingDocuments ? application.workingLetterId : null,
        },
        ctx,
        application.id,
    );
}
