import { localDateOnly } from "./dates";
import { isOpenTask } from "./operations";
import { APPLICATION_STAGES, isTerminalStage, type ApplicationInterview, type ApplicationStage, type ApplicationTask, type JobApplication } from "./schema";

/**
 * What the board and list show. Filters combine with AND; the values chosen inside one filter combine
 * with OR. Everything runs over records already in memory, so it stays fast without an index.
 */

export const APPLICATION_SCOPES = ["current", "archived", "trash"] as const;
export type ApplicationScope = (typeof APPLICATION_SCOPES)[number];

export const DOCUMENT_FILTERS = ["cv", "letter", "none"] as const;
export type DocumentFilter = (typeof DOCUMENT_FILTERS)[number];

export const APPLICATION_SORTS = ["updated", "next", "company", "role"] as const;
export type ApplicationSort = (typeof APPLICATION_SORTS)[number];

export interface ApplicationFilters {
    query: string;
    scope: ApplicationScope;
    stages: ApplicationStage[];
    tags: string[];
    documents: DocumentFilter[];
    /** Only applications with an overdue or due-today task. */
    dueOnly: boolean;
}

export const EMPTY_FILTERS: ApplicationFilters = { query: "", scope: "current", stages: [], tags: [], documents: [], dueOnly: false };

/** True when anything narrows the list beyond the default "current" view. */
export function hasActiveFilters(filters: ApplicationFilters): boolean {
    return filters.query.trim() !== "" || filters.scope !== "current" || filters.stages.length > 0 || filters.tags.length > 0 || filters.documents.length > 0 || filters.dueOnly;
}

function inScope(application: JobApplication, scope: ApplicationScope): boolean {
    if (scope === "trash") return application.trashedAt !== null;
    if (application.trashedAt !== null) return false;
    return scope === "archived" ? application.archivedAt !== null : application.archivedAt === null;
}

function matchesDocuments(application: JobApplication, documents: DocumentFilter[]): boolean {
    if (documents.length === 0) return true;
    return documents.some((filter) =>
        filter === "cv" ? application.workingCvId !== null
            : filter === "letter" ? application.workingLetterId !== null
                : application.workingCvId === null && application.workingLetterId === null,
    );
}

function matchesQuery(application: JobApplication, needle: string): boolean {
    if (!needle) return true;
    const fields = [application.company, application.role, application.location ?? "", application.notesMarkdown, ...application.tags];
    return fields.some((field) => field.toLocaleLowerCase().includes(needle));
}

export function filterApplications(applications: readonly JobApplication[], filters: ApplicationFilters, today: string = localDateOnly()): JobApplication[] {
    const needle = filters.query.trim().toLocaleLowerCase();
    const tags = new Set(filters.tags.map((tag) => tag.toLocaleLowerCase()));
    return applications.filter((application) =>
        inScope(application, filters.scope)
        && (filters.stages.length === 0 || filters.stages.includes(application.stage))
        && (tags.size === 0 || application.tags.some((tag) => tags.has(tag.toLocaleLowerCase())))
        && matchesDocuments(application, filters.documents)
        && (!filters.dueOnly || hasDueTask(application, today))
        && matchesQuery(application, needle),
    );
}

export function sortApplications(applications: readonly JobApplication[], sort: ApplicationSort, locale: string, today: string = localDateOnly()): JobApplication[] {
    if (sort === "next") {
        // Soonest next action first; applications with nothing to do keep their latest-update order after them.
        const keys = new Map(applications.map((application) => [application.id, nextAction(application, today)?.sortKey ?? null]));
        return sortApplications(applications, "updated", locale).sort((a, b) => {
            const ka = keys.get(a.id) ?? null;
            const kb = keys.get(b.id) ?? null;
            if (ka === kb) return 0;
            if (ka === null) return 1;
            if (kb === null) return -1;
            return ka.localeCompare(kb);
        });
    }
    const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
    const byUpdated = (a: JobApplication, b: JobApplication) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id);
    return [...applications].sort((a, b) => {
        if (sort === "company") return collator.compare(a.company, b.company) || collator.compare(a.role, b.role) || byUpdated(a, b);
        if (sort === "role") return collator.compare(a.role, b.role) || collator.compare(a.company, b.company) || byUpdated(a, b);
        return byUpdated(a, b);
    });
}

export function groupByStage(applications: readonly JobApplication[]): Record<ApplicationStage, JobApplication[]> {
    const groups = Object.fromEntries(APPLICATION_STAGES.map((stage) => [stage, [] as JobApplication[]])) as Record<ApplicationStage, JobApplication[]>;
    for (const application of applications) groups[application.stage].push(application);
    return groups;
}

export interface TrackerSummary {
    /** Not archived, not trashed, in an active stage. Independent of the filters on screen. */
    active: number;
    offers: number;
    archived: number;
    trashed: number;
}

export function summarize(applications: readonly JobApplication[]): TrackerSummary {
    let active = 0;
    let offers = 0;
    let archived = 0;
    let trashed = 0;
    for (const application of applications) {
        if (application.trashedAt !== null) {
            trashed += 1;
            continue;
        }
        if (application.archivedAt !== null) {
            archived += 1;
            continue;
        }
        if (!isTerminalStage(application.stage)) active += 1;
        if (application.stage === "offer") offers += 1;
    }
    return { active, offers, archived, trashed };
}

/** Every tag in use, first spelling kept, for the tag filter. */
export function allTags(applications: readonly JobApplication[], locale: string): string[] {
    const seen = new Map<string, string>();
    for (const application of applications) {
        if (application.trashedAt !== null) continue;
        for (const tag of application.tags) {
            const key = tag.toLocaleLowerCase();
            if (!seen.has(key)) seen.set(key, tag);
        }
    }
    const collator = new Intl.Collator(locale, { sensitivity: "base" });
    return [...seen.values()].sort(collator.compare);
}

export type DuplicateMatch = { application: JobApplication; reason: "url" | "company-role" };

function normalizeUrl(value: string): string {
    try {
        const url = new URL(value);
        url.hash = "";
        return `${url.host.toLocaleLowerCase()}${url.pathname.replace(/\/+$/, "")}${url.search}`;
    } catch {
        return value.trim().toLocaleLowerCase();
    }
}

/**
 * A possible duplicate among records not in the trash: the same job link, or the same company and role
 * ignoring case and spacing. Only a warning; reapplying is legitimate.
 */
export function findPossibleDuplicate(
    applications: readonly JobApplication[],
    candidate: { company: string; role: string; jobUrl: string | null },
): DuplicateMatch | null {
    const fold = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
    const url = candidate.jobUrl ? normalizeUrl(candidate.jobUrl) : null;
    const live = applications.filter((application) => application.trashedAt === null);
    if (url) {
        const match = live.find((application) => application.jobUrl !== null && normalizeUrl(application.jobUrl) === url);
        if (match) return { application: match, reason: "url" };
    }
    const company = fold(candidate.company);
    const role = fold(candidate.role);
    const match = live.find((application) => fold(application.company) === company && fold(application.role) === role);
    return match ? { application: match, reason: "company-role" } : null;
}
// ---- Next actions ----------------------------------------------------------------------------------

export type DueState = "overdue" | "today" | "upcoming" | "undated";

export function dueState(dueOn: string | null, today: string): DueState {
    if (dueOn === null) return "undated";
    return dueOn < today ? "overdue" : dueOn === today ? "today" : "upcoming";
}

export type NextAction =
    | { kind: "task"; task: ApplicationTask; due: DueState; sortKey: string }
    | { kind: "interview"; interview: ApplicationInterview; sortKey: string };

const UNDATED_KEY = "9999-12-31~";

/**
 * The one thing to do next for an application: the earliest open task or scheduled interview, by the
 * viewer's calendar. Overdue tasks come first; undated tasks only when nothing is dated.
 */
export function nextAction(application: JobApplication, today: string): NextAction | null {
    const candidates: NextAction[] = [
        ...application.tasks.filter(isOpenTask).map((task) => ({ kind: "task" as const, task, due: dueState(task.dueOn, today), sortKey: task.dueOn ?? UNDATED_KEY })),
        ...application.interviews
            .filter((interview) => interview.outcome === "scheduled" && interview.startsAt !== null)
            .map((interview) => ({ kind: "interview" as const, interview, sortKey: localDateOnly(new Date(interview.startsAt!)) })),
    ];
    candidates.sort((a, b) => a.sortKey.localeCompare(b.sortKey) || (a.kind === "task" ? -1 : 1));
    return candidates[0] ?? null;
}

export interface TaskEntry { application: JobApplication; task: ApplicationTask; due: DueState }
export interface InterviewEntry { application: JobApplication; interview: ApplicationInterview }

export interface NextActionGroups {
    overdue: TaskEntry[];
    today: TaskEntry[];
    upcoming: TaskEntry[];
    interviews: InterviewEntry[];
}

/**
 * Every open task and every scheduled interview of current (not archived, not trashed) applications.
 * Tasks are grouped by due state; undated ones close the upcoming group. Interviews whose time passed stay
 * until the person records an outcome; ones without a time come last.
 */
export function nextActionGroups(applications: readonly JobApplication[], today: string): NextActionGroups {
    const groups: NextActionGroups = { overdue: [], today: [], upcoming: [], interviews: [] };
    for (const application of applications) {
        if (application.trashedAt !== null || application.archivedAt !== null) continue;
        for (const task of application.tasks) {
            if (!isOpenTask(task)) continue;
            const due = dueState(task.dueOn, today);
            groups[due === "undated" ? "upcoming" : due].push({ application, task, due });
        }
        for (const interview of application.interviews) {
            if (interview.outcome === "scheduled") groups.interviews.push({ application, interview });
        }
    }
    const byDue = (a: TaskEntry, b: TaskEntry) => (a.task.dueOn ?? UNDATED_KEY).localeCompare(b.task.dueOn ?? UNDATED_KEY) || a.task.createdAt - b.task.createdAt;
    groups.overdue.sort(byDue);
    groups.today.sort(byDue);
    groups.upcoming.sort(byDue);
    groups.interviews.sort((a, b) => (a.interview.startsAt ?? Number.MAX_SAFE_INTEGER) - (b.interview.startsAt ?? Number.MAX_SAFE_INTEGER));
    return groups;
}

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Due-now tasks and interviews in the next seven days, over current applications. */
export function actionCounts(applications: readonly JobApplication[], today: string, now: number): { due: number; interviewsThisWeek: number } {
    const groups = nextActionGroups(applications, today);
    const interviewsThisWeek = groups.interviews.filter(({ interview }) => interview.startsAt !== null && interview.startsAt >= now && interview.startsAt < now + WEEK).length;
    return { due: groups.overdue.length + groups.today.length, interviewsThisWeek };
}

/** True when the application has an open task that is overdue or due today. */
export function hasDueTask(application: JobApplication, today: string): boolean {
    return application.tasks.some((task) => isOpenTask(task) && task.dueOn !== null && task.dueOn <= today);
}
