import { createId } from "@/lib/id";
import { isTerminalStage, type ApplicationContact, type ApplicationEvent, type ApplicationInterview, type ApplicationStage, type ApplicationSubmission, type ApplicationTask, type JobApplication } from "./schema";

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

// ---- Tasks -----------------------------------------------------------------------------------------

export function isOpenTask(task: ApplicationTask): boolean {
    return task.completedAt === null && task.cancelledAt === null;
}

export function addTask(application: JobApplication, input: { title: string; dueOn: string | null }, ctx: OperationContext): JobApplication {
    const task: ApplicationTask = { id: ctx.newId(), title: input.title.trim(), dueOn: input.dueOn, completedAt: null, cancelledAt: null, createdAt: ctx.now };
    return { ...application, tasks: [...application.tasks, task] };
}

export function editTask(application: JobApplication, taskId: string, input: { title: string; dueOn: string | null }): JobApplication {
    const task = application.tasks.find((item) => item.id === taskId);
    if (!task || (task.title === input.title.trim() && task.dueOn === input.dueOn)) return application;
    return { ...application, tasks: application.tasks.map((item) => (item.id === taskId ? { ...item, title: input.title.trim(), dueOn: input.dueOn } : item)) };
}

function closeTask(application: JobApplication, taskId: string, how: "completed" | "cancelled", ctx: OperationContext): JobApplication {
    const task = application.tasks.find((item) => item.id === taskId);
    if (!task || !isOpenTask(task)) return application;
    return {
        ...application,
        tasks: application.tasks.map((item) => (item.id === taskId ? { ...item, [how === "completed" ? "completedAt" : "cancelledAt"]: ctx.now } : item)),
        events: [...application.events, event({ type: how === "completed" ? "task-completed" : "task-cancelled", taskId }, ctx)],
    };
}

export const completeTask = (application: JobApplication, taskId: string, ctx: OperationContext) => closeTask(application, taskId, "completed", ctx);
export const cancelTask = (application: JobApplication, taskId: string, ctx: OperationContext) => closeTask(application, taskId, "cancelled", ctx);

/** Back to open, for a task ticked by mistake. The earlier event stays in the timeline. */
export function reopenTask(application: JobApplication, taskId: string): JobApplication {
    const task = application.tasks.find((item) => item.id === taskId);
    if (!task || isOpenTask(task)) return application;
    return { ...application, tasks: application.tasks.map((item) => (item.id === taskId ? { ...item, completedAt: null, cancelledAt: null } : item)) };
}

/** Removes a task that was added by mistake. Closed tasks keep their timeline events. */
export function removeTask(application: JobApplication, taskId: string): JobApplication {
    if (!application.tasks.some((item) => item.id === taskId)) return application;
    return { ...application, tasks: application.tasks.filter((item) => item.id !== taskId) };
}

/** Cancels every open task, for a move to a closed stage when the person chooses to. */
export function cancelOpenTasks(application: JobApplication, ctx: OperationContext): JobApplication {
    return application.tasks.filter(isOpenTask).reduce((current, task) => cancelTask(current, task.id, ctx), application);
}

/** The date-only value `days` calendar days after `date` (no time zone involved). */
export function addCalendarDays(date: string, days: number): string {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// ---- Interviews ------------------------------------------------------------------------------------

export type InterviewInput = Pick<ApplicationInterview, "label" | "startsAt" | "endsAt" | "timeZone" | "location" | "link" | "contactIds" | "notes" | "outcome">;

/**
 * Adds an interview round. It moves an Applied application to Interviewing; a closed one changes stage
 * only when the person confirmed reopening it (`reopen`). Stages before Applied are left as they are.
 */
export function addInterview(application: JobApplication, input: InterviewInput, ctx: OperationContext, options: { reopen: boolean } = { reopen: false }): JobApplication {
    const interview: ApplicationInterview = { ...input, label: input.label.trim(), id: ctx.newId(), createdAt: ctx.now, updatedAt: ctx.now };
    const withInterview: JobApplication = {
        ...application,
        interviews: [...application.interviews, interview],
        events: [...application.events, event({ type: "interview-changed", interviewId: interview.id, outcome: interview.outcome }, ctx)],
    };
    const moves = application.stage === "applied" || (isTerminalStage(application.stage) && options.reopen);
    return moves ? changeStage(withInterview, "interviewing", ctx) : withInterview;
}

/** An interview is never completed just because its time passed; the person records the outcome. */
export function updateInterview(application: JobApplication, interviewId: string, input: InterviewInput, ctx: OperationContext): JobApplication {
    const current = application.interviews.find((item) => item.id === interviewId);
    if (!current) return application;
    const next = { ...current, ...input, label: input.label.trim() };
    if (JSON.stringify({ ...next, updatedAt: 0 }) === JSON.stringify({ ...current, updatedAt: 0 })) return application;
    return {
        ...application,
        interviews: application.interviews.map((item) => (item.id === interviewId ? { ...next, updatedAt: ctx.now } : item)),
        events: [...application.events, event({ type: "interview-changed", interviewId, outcome: next.outcome }, ctx)],
    };
}

export function removeInterview(application: JobApplication, interviewId: string): JobApplication {
    if (!application.interviews.some((item) => item.id === interviewId)) return application;
    return { ...application, interviews: application.interviews.filter((item) => item.id !== interviewId) };
}

// ---- Contacts and notes ----------------------------------------------------------------------------

export type ContactInput = Omit<ApplicationContact, "id">;

export function addContact(application: JobApplication, input: ContactInput, ctx: OperationContext): JobApplication {
    return { ...application, contacts: [...application.contacts, { ...input, name: input.name.trim(), id: ctx.newId() }] };
}

export function updateContact(application: JobApplication, contactId: string, input: ContactInput): JobApplication {
    if (!application.contacts.some((item) => item.id === contactId)) return application;
    return { ...application, contacts: application.contacts.map((item) => (item.id === contactId ? { ...input, name: input.name.trim(), id: contactId } : item)) };
}

/** Removing a contact also drops it from the interviews that named it. */
export function removeContact(application: JobApplication, contactId: string): JobApplication {
    if (!application.contacts.some((item) => item.id === contactId)) return application;
    return {
        ...application,
        contacts: application.contacts.filter((item) => item.id !== contactId),
        interviews: application.interviews.map((item) => (item.contactIds.includes(contactId) ? { ...item, contactIds: item.contactIds.filter((id) => id !== contactId) } : item)),
    };
}

/** A dated note in the activity timeline, apart from the free-form notes field. */
export function addNote(application: JobApplication, text: string, ctx: OperationContext): JobApplication {
    if (!text.trim()) return application;
    return { ...application, events: [...application.events, event({ type: "note", text: text.trim() }, ctx)] };
}
