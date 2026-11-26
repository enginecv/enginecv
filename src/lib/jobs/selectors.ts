import { APPLICATION_STAGES, isTerminalStage, type ApplicationStage, type JobApplication } from "./schema";

/**
 * What the board and list show. Filters combine with AND; the values chosen inside one filter combine
 * with OR. Everything runs over records already in memory, so it stays fast without an index.
 */

export const APPLICATION_SCOPES = ["current", "archived", "trash"] as const;
export type ApplicationScope = (typeof APPLICATION_SCOPES)[number];

export const DOCUMENT_FILTERS = ["cv", "letter", "none"] as const;
export type DocumentFilter = (typeof DOCUMENT_FILTERS)[number];

export const APPLICATION_SORTS = ["updated", "company", "role"] as const;
export type ApplicationSort = (typeof APPLICATION_SORTS)[number];

export interface ApplicationFilters {
    query: string;
    scope: ApplicationScope;
    stages: ApplicationStage[];
    tags: string[];
    documents: DocumentFilter[];
}

export const EMPTY_FILTERS: ApplicationFilters = { query: "", scope: "current", stages: [], tags: [], documents: [] };

/** True when anything narrows the list beyond the default "current" view. */
export function hasActiveFilters(filters: ApplicationFilters): boolean {
    return filters.query.trim() !== "" || filters.scope !== "current" || filters.stages.length > 0 || filters.tags.length > 0 || filters.documents.length > 0;
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

export function filterApplications(applications: readonly JobApplication[], filters: ApplicationFilters): JobApplication[] {
    const needle = filters.query.trim().toLocaleLowerCase();
    const tags = new Set(filters.tags.map((tag) => tag.toLocaleLowerCase()));
    return applications.filter((application) =>
        inScope(application, filters.scope)
        && (filters.stages.length === 0 || filters.stages.includes(application.stage))
        && (tags.size === 0 || application.tags.some((tag) => tags.has(tag.toLocaleLowerCase())))
        && matchesDocuments(application, filters.documents)
        && matchesQuery(application, needle),
    );
}

export function sortApplications(applications: readonly JobApplication[], sort: ApplicationSort, locale: string): JobApplication[] {
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