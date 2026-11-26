"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowUpDown, Briefcase, Columns3, List, ListFilter, Plus, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { DASHBOARD_CONTENT_CLASS, DASHBOARD_NAV_CLASS } from "@/components/dashboard/layout";
import { ChoiceMenu } from "@/components/dashboard/ListControls";
import { NavSearch } from "@/components/dashboard/NavSearch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { APPLICATION_PARAM, urlWithApplication } from "@/lib/dashboard-tab-url";
import { useTranslation } from "@/lib/i18n";
import { changeStage } from "@/lib/jobs/operations";
import { listApplications } from "@/lib/jobs/repository";
import { APPLICATION_STAGES, type ApplicationStage, type JobApplication } from "@/lib/jobs/schema";
import {
    APPLICATION_SCOPES, APPLICATION_SORTS, DOCUMENT_FILTERS, EMPTY_FILTERS, allTags, filterApplications, groupByStage, hasActiveFilters, sortApplications, summarize,
    type ApplicationFilters, type ApplicationSort,
} from "@/lib/jobs/selectors";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import { AddJobDialog } from "./AddJobDialog";
import { ApplicationDetails } from "./ApplicationDetails";
import { JobBoard } from "./JobBoard";
import { JobList } from "./JobList";
import { BUTTON_CLASS, PRIMARY_BUTTON_CLASS, applicationTitle, runCommand, useCommandError, useStageLabel } from "./shared";

const WIDE_QUERY = "(min-width: 768px)";

/** Board on wide screens, list on narrow ones, until the person picks a view. */
function useIsWide(): boolean {
    return useSyncExternalStore(
        (notify) => {
            const media = window.matchMedia(WIDE_QUERY);
            media.addEventListener("change", notify);
            return () => media.removeEventListener("change", notify);
        },
        () => window.matchMedia(WIDE_QUERY).matches,
        () => true,
    );
}

function toggle<T>(values: readonly T[], value: T): T[] {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function FilterGroup({ legend, children }: { legend: string; children: ReactNode }) {
    return (
        <fieldset className="mb-3">
            <legend className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">{legend}</legend>
            <div className="flex flex-col">{children}</div>
        </fieldset>
    );
}

function FilterCheck({ label, checked, onChange, testId, type = "checkbox", name }: { label: string; checked: boolean; onChange: () => void; testId: string; type?: "checkbox" | "radio"; name?: string }) {
    return (
        <label className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm text-mid hover:bg-surface-4/70 hover:text-strong">
            <input type={type} name={name} checked={checked} onChange={onChange} data-testid={testId} className="h-4 w-4 accent-[var(--accent)]" />
            <span className="break-words">{label}</span>
        </label>
    );
}

/**
 * The Job Tracker tab: board, list, search and filters over applications stored in this browser.
 * Nothing here makes a network request; an application opens in a sheet whose id (and only its id)
 * goes into the URL so it can be linked and reopened.
 */
export function JobsTab({ navLead, navTrail }: { navLead?: ReactNode; navTrail?: ReactNode }) {
    const { t, locale } = useTranslation();
    const stageLabel = useStageLabel();
    const commandError = useCommandError();
    const searchParams = useSearchParams();
    const applications = useLiveQuery(() => listApplications(), []);
    const storedView = useClientPreferencesStore((state) => state.preferences.dashboard.jobsView);
    const updateSection = useClientPreferencesStore((state) => state.updateSection);
    const isWide = useIsWide();
    const view = storedView === "auto" ? (isWide ? "board" : "list") : storedView;

    const [filters, setFilters] = useState<ApplicationFilters>(EMPTY_FILTERS);
    const [sort, setSort] = useState<ApplicationSort>("updated");
    const [showClosed, setShowClosed] = useState(false);
    const [adding, setAdding] = useState<ApplicationStage | null>(null);
    // Production builds do not re-render useSearchParams after replaceState, so the open id lives here.
    const [openId, setOpenId] = useState<string | null>(() => searchParams?.get(APPLICATION_PARAM) ?? null);
    const [announcement, setAnnouncement] = useState("");

    const announce = useCallback((message: string) => {
        // Cleared first so the same message twice is still read out.
        setAnnouncement("");
        requestAnimationFrame(() => setAnnouncement(message));
    }, []);

    const open = useCallback((id: string | null) => {
        setOpenId(id);
        window.history.replaceState(window.history.state, "", urlWithApplication(window.location, id));
    }, []);

    const visible = useMemo(
        () => (applications ? sortApplications(filterApplications(applications, filters), sort, locale) : []),
        [applications, filters, sort, locale],
    );
    const groups = useMemo(() => groupByStage(visible), [visible]);
    const summary = useMemo(() => summarize(applications ?? []), [applications]);
    const tags = useMemo(() => allTags(applications ?? [], locale), [applications, locale]);
    const opened = openId && applications ? applications.find((application) => application.id === openId) : undefined;

    const move = useCallback(async (application: JobApplication, stage: ApplicationStage) => {
        const outcome = await runCommand(application, (current, ctx) => changeStage(current, stage, ctx));
        announce(outcome.ok ? t("jobs.announce.moved", { job: applicationTitle(application), stage: stageLabel(stage) }) : commandError(outcome.reason));
    }, [announce, commandError, stageLabel, t]);

    const filterCount = filters.stages.length + filters.tags.length + filters.documents.length + (filters.scope === "current" ? 0 : 1);
    const effectiveView = filters.scope === "trash" ? "list" : view;

    const controls = (
        <>
            <NavSearch value={filters.query} onChange={(query) => setFilters((current) => ({ ...current, query }))} placeholder={t("jobs.search")} testId="jobs-search" />
            <Popover>
                <PopoverTrigger asChild>
                    <button type="button" className={BUTTON_CLASS} aria-label={t("jobs.filters.title", { count: filterCount })} data-testid="jobs-filters">
                        <ListFilter className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden lg:inline">{t("jobs.filters.button")}</span>
                        {filterCount > 0 && <span className="rounded-md bg-accent px-1.5 text-xs font-bold text-surface-2 tabular-nums">{filterCount}</span>}
                    </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="max-h-[70dvh] w-64 overflow-y-auto p-2">
                    <FilterGroup legend={t("jobs.filters.show")}>
                        {APPLICATION_SCOPES.map((scope) => (
                            <FilterCheck key={scope} type="radio" name="jobs-scope" label={t(`jobs.scope.${scope}`)} checked={filters.scope === scope} onChange={() => setFilters((current) => ({ ...current, scope }))} testId={`jobs-scope-${scope}`} />
                        ))}
                    </FilterGroup>
                    <FilterGroup legend={t("jobs.filters.stage")}>
                        {APPLICATION_STAGES.map((stage) => (
                            <FilterCheck key={stage} label={stageLabel(stage)} checked={filters.stages.includes(stage)} onChange={() => setFilters((current) => ({ ...current, stages: toggle(current.stages, stage) }))} testId={`jobs-filter-stage-${stage}`} />
                        ))}
                    </FilterGroup>
                    <FilterGroup legend={t("jobs.filters.documents")}>
                        {DOCUMENT_FILTERS.map((filter) => (
                            <FilterCheck key={filter} label={t(`jobs.filters.document.${filter}`)} checked={filters.documents.includes(filter)} onChange={() => setFilters((current) => ({ ...current, documents: toggle(current.documents, filter) }))} testId={`jobs-filter-documents-${filter}`} />
                        ))}
                    </FilterGroup>
                    {tags.length > 0 && (
                        <FilterGroup legend={t("jobs.filters.tags")}>
                            {tags.map((tag) => (
                                <FilterCheck key={tag} label={tag} checked={filters.tags.includes(tag)} onChange={() => setFilters((current) => ({ ...current, tags: toggle(current.tags, tag) }))} testId={`jobs-filter-tag-${tag}`} />
                            ))}
                        </FilterGroup>
                    )}
                    {/* Phones have no room for the sort and view controls in the toolbar; they live here instead. */}
                    <div className="sm:hidden">
                        <FilterGroup legend={t("dashboard.sortBy")}>
                            {APPLICATION_SORTS.map((option) => (
                                <FilterCheck key={option} type="radio" name="jobs-sort-narrow" label={t(`jobs.sort.${option}`)} checked={sort === option} onChange={() => setSort(option)} testId={`jobs-sort-narrow-${option}`} />
                            ))}
                        </FilterGroup>
                        <FilterGroup legend={t("jobs.view.label")}>
                            {(["board", "list"] as const).map((option) => (
                                <FilterCheck key={option} type="radio" name="jobs-view-narrow" label={t(`jobs.view.${option}`)} checked={view === option} onChange={() => updateSection("dashboard", { jobsView: option })} testId={`jobs-view-narrow-${option}`} />
                            ))}
                        </FilterGroup>
                    </div>
                    <button type="button" disabled={!hasActiveFilters(filters)} onClick={() => setFilters(EMPTY_FILTERS)} className="w-full rounded-lg px-2 py-2 text-sm font-medium text-accent hover:underline disabled:opacity-50" data-testid="jobs-filters-clear">{t("jobs.filters.clear")}</button>
                </PopoverContent>
            </Popover>
            <ChoiceMenu
                value={sort}
                options={APPLICATION_SORTS}
                label={(option) => t(`jobs.sort.${option}`)}
                onChange={setSort}
                title={t("dashboard.sortBy")}
                icon={<ArrowUpDown className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />}
                testId="jobs-sort"
                className="hidden sm:flex"
            />
            <div role="group" aria-label={t("jobs.view.label")} className="hidden shrink-0 rounded-xl border border-edge bg-surface-4 p-0.5 sm:flex">
                {(["board", "list"] as const).map((option) => {
                    const Icon = option === "board" ? Columns3 : List;
                    return (
                        <button
                            key={option}
                            type="button"
                            aria-pressed={view === option}
                            title={t(`jobs.view.${option}`)}
                            onClick={() => updateSection("dashboard", { jobsView: option })}
                            data-testid={`jobs-view-${option}`}
                            className={`flex h-9 w-9 items-center justify-center rounded-lg ${view === option ? "bg-surface-2 text-strong" : "text-faint hover:text-strong"}`}
                        >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">{t(`jobs.view.${option}`)}</span>
                        </button>
                    );
                })}
            </div>
        </>
    );

    let content: ReactNode;
    if (applications === undefined) {
        content = (
            <div className="grid gap-4 md:grid-cols-3" data-testid="jobs-loading" aria-busy="true" aria-label={t("jobs.loading")}>
                {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-40 w-full rounded-2xl" />)}
            </div>
        );
    } else if (applications.length === 0) {
        content = (
            <div className="mx-auto max-w-md py-16 text-center" data-testid="jobs-empty">
                <Briefcase className="mx-auto h-10 w-10 text-faint" aria-hidden="true" />
                <h2 className="mt-4 text-xl font-bold text-strong">{t("jobs.empty.title")}</h2>
                <p className="mt-2 text-sm text-mid">{t("jobs.empty.body")}</p>
                <button type="button" onClick={() => setAdding("saved")} className={`${PRIMARY_BUTTON_CLASS} mx-auto mt-6`} data-testid="jobs-empty-add">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {t("jobs.empty.add")}
                </button>
            </div>
        );
    } else {
        content = (
            <>
                <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" data-testid="jobs-summary">
                    <p className="text-mid"><span className="font-semibold tabular-nums text-strong">{summary.active}</span> {t("jobs.summary.active")}</p>
                    <p className="text-mid"><span className="font-semibold tabular-nums text-strong">{summary.offers}</span> {t("jobs.summary.offers")}</p>
                    {summary.trashed > 0 && filters.scope !== "trash" && (
                        <button type="button" onClick={() => setFilters({ ...EMPTY_FILTERS, scope: "trash" })} className="ml-auto flex items-center gap-1.5 text-mid hover:text-strong" data-testid="jobs-open-trash">
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            {t("jobs.trashCount", { count: summary.trashed })}
                        </button>
                    )}
                </div>
                {filters.scope !== "current" && (
                    <p className="mb-4 rounded-xl border border-edge bg-surface-3 px-3 py-2 text-sm text-mid" data-testid="jobs-scope-note">
                        {t(filters.scope === "trash" ? "jobs.scopeNote.trash" : "jobs.scopeNote.archived")}{" "}
                        <button type="button" onClick={() => setFilters((current) => ({ ...current, scope: "current" }))} className="font-medium text-accent hover:underline">{t("jobs.scopeNote.back")}</button>
                    </p>
                )}
                {visible.length === 0 ? (
                    <div className="py-12 text-center" data-testid="jobs-no-match">
                        <p className="text-sm text-mid">{t("jobs.noMatch")}</p>
                        {hasActiveFilters(filters) && <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className={`${BUTTON_CLASS} mx-auto mt-4`} data-testid="jobs-no-match-clear">{t("jobs.filters.clear")}</button>}
                    </div>
                ) : effectiveView === "board" ? (
                    <JobBoard groups={groups} onOpen={open} onMove={move} showClosed={showClosed} onToggleClosed={() => setShowClosed((value) => !value)} onAdd={setAdding} />
                ) : (
                    <JobList applications={visible} onOpen={open} onMove={move} />
                )}
            </>
        );
    }

    return (
        <>
            <nav className={DASHBOARD_NAV_CLASS} aria-label={t("jobs.toolbar")} data-testid="jobs-nav">
                <div className="relative mx-auto flex h-full w-full max-w-7xl items-center gap-2 px-4 py-3 sm:px-6 md:py-0 lg:px-8">
                    {navLead}
                    {controls}
                    <div className="ml-auto flex items-center gap-2">
                        <button type="button" onClick={() => setAdding("saved")} className={PRIMARY_BUTTON_CLASS} title={t("jobs.add.button")} data-testid="jobs-add">
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            <span className="hidden sm:inline">{t("jobs.add.button")}</span>
                            <span className="sr-only sm:hidden">{t("jobs.add.button")}</span>
                        </button>
                        {navTrail}
                    </div>
                </div>
            </nav>
            <div className={`${DASHBOARD_CONTENT_CLASS} pb-16 pt-8`}>
                <h1 className="sr-only">{t("dashboard.tabJobs")}</h1>
                {content}
            </div>
            <p role="status" aria-live="polite" className="sr-only" data-testid="jobs-announcer">{announcement}</p>

            {adding && applications && (
                <AddJobDialog
                    applications={applications}
                    initialStage={adding}
                    onClose={() => setAdding(null)}
                    onCreated={(application) => {
                        setAdding(null);
                        announce(t("jobs.announce.created", { job: applicationTitle(application) }));
                        open(application.id);
                    }}
                    onOpenExisting={(id) => {
                        setAdding(null);
                        open(id);
                    }}
                />
            )}
            {opened && <ApplicationDetails key={opened.id} application={opened} onClose={() => open(null)} onAnnounce={announce} onOpen={open} />}
            {openId && applications && !opened && (
                <div role="alertdialog" aria-labelledby="job-not-found" className="fixed bottom-6 left-1/2 z-[210] flex -translate-x-1/2 items-center gap-4 rounded-xl border border-edge bg-surface-4 px-4 py-3 shadow-2xl" data-testid="job-not-found">
                    <span id="job-not-found" className="text-sm text-strong">{t("jobs.notFound")}</span>
                    <button type="button" onClick={() => open(null)} className="text-sm font-bold text-accent hover:underline">{t("common.close")}</button>
                </div>
            )}
        </>
    );
}
