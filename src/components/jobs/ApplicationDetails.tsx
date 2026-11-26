"use client";

import { Archive, ArchiveRestore, Copy, ExternalLink, FileText, Mail, RotateCcw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";
import { detailsFromForm, formFromApplication, type DetailsErrors, type DetailsField, type DetailsForm } from "@/lib/jobs/form";
import { archive, changeStage, defaultContext, duplicate, restore, trash, unarchive, updateDetails } from "@/lib/jobs/operations";
import { deleteApplicationPermanently, insertApplication } from "@/lib/jobs/repository";
import { isSafeWebUrl, type ApplicationEvent, type ApplicationStage, type JobApplication } from "@/lib/jobs/schema";
import { ApplicationDocuments } from "./ApplicationDocuments";
import { EssentialFields, MoreFields } from "./DetailsFields";
import { useDocumentChoices } from "./useDocumentChoices";
import { BUTTON_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS, StageMenu, TEXTAREA_CLASS, runCommand, useCommandError, useStageLabel } from "./shared";

const AUTOSAVE_DELAY_MS = 700;

type SaveState = "idle" | "pending" | "saving" | "saved" | "invalid" | "failed" | "conflict";
type DetailsTab = "overview" | "documents" | "activity";
const DETAILS_TABS: readonly DetailsTab[] = ["overview", "documents", "activity"];

/**
 * One application, opened from the board or list (or a deep link). Edits save on their own after a short
 * pause, against the revision they started from; a newer save elsewhere is never overwritten. The person
 * chooses to load the latest or reapply their edits on top of it.
 */
export function ApplicationDetails({ application, onClose, onAnnounce, onOpen }: {
    application: JobApplication;
    onClose: () => void;
    onAnnounce: (message: string) => void;
    /** Opens another application (the duplicate just made). */
    onOpen: (id: string) => void;
}) {
    const { t } = useTranslation();
    const stageLabel = useStageLabel();
    const commandError = useCommandError();
    const ref = useDialogFocus<HTMLDivElement>(true, onClose);
    const [tab, setTab] = useState<DetailsTab>("overview");
    // Local edits not yet saved; without any, the form shows the stored record (a stage change, another tab, a restore).
    const [draft, setDraft] = useState<DetailsForm | null>(null);
    const stored = useMemo(() => formFromApplication(application), [application]);
    const form = draft ?? stored;
    const dirty = draft !== null;
    const [errors, setErrors] = useState<DetailsErrors>({});
    const [saveState, setSaveState] = useState<SaveState>("idle");
    const [confirmDelete, setConfirmDelete] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latest = useRef(application);
    // The revision the next save is based on, the edit count it covers, and the save in flight (saves run one at a time).
    const revision = useRef(application.revision);
    const edits = useRef(0);
    const inFlight = useRef<Promise<void> | null>(null);

    useEffect(() => {
        latest.current = application;
    }, [application]);

    const save = useCallback(async (draft: DetailsForm) => {
        const result = detailsFromForm(draft);
        if (!result.ok) {
            setErrors(result.errors);
            setSaveState("invalid");
            return;
        }
        setErrors({});
        while (inFlight.current) await inFlight.current;
        const covered = edits.current;
        const run = (async () => {
            setSaveState("saving");
            const outcome = await runCommand({ ...latest.current, revision: revision.current }, (current) => updateDetails(current, result.details));
            if (!outcome.ok) {
                setSaveState(outcome.reason === "stale" ? "conflict" : "failed");
                return;
            }
            revision.current = outcome.application.revision;
            // Only clean if nothing was typed while saving; otherwise the newer edits save next.
            if (edits.current === covered) {
                setDraft(null);
                setSaveState("saved");
            }
        })();
        inFlight.current = run;
        await run;
        inFlight.current = null;
    }, []);

    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current);
    }, []);

    const change = <K extends DetailsField>(field: K, value: DetailsForm[K]) => {
        // A new round of edits starts from the record on screen.
        if (!dirty) revision.current = application.revision;
        const next = { ...form, [field]: value };
        setDraft(next);
        edits.current += 1;
        if (saveState === "conflict") return;
        setSaveState("pending");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void save(next), AUTOSAVE_DELAY_MS);
    };

    const flushAndClose = () => {
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
            if (dirty && saveState === "pending") void save(form);
        }
        onClose();
    };

    const act = async (operation: Parameters<typeof runCommand>[1], message: string) => {
        const outcome = await runCommand(application, operation);
        onAnnounce(outcome.ok ? message : commandError(outcome.reason));
        return outcome.ok;
    };

    const title = `${application.role} · ${application.company}`;
    const trashed = application.trashedAt !== null;

    const handleDuplicate = async () => {
        try {
            const copy = await insertApplication(duplicate(application, defaultContext(), { keepWorkingDocuments: true }));
            onAnnounce(t("jobs.announce.duplicated", { job: title }));
            onOpen(copy.id);
        } catch (error) {
            console.error("[EngineCV] Could not duplicate the application.", error);
            onAnnounce(t("jobs.error.save"));
        }
    };

    const handleDelete = async () => {
        setConfirmDelete(false);
        try {
            await deleteApplicationPermanently(application.id, application.revision);
            onAnnounce(t("jobs.announce.deleted", { job: title }));
            onClose();
        } catch (error) {
            console.error("[EngineCV] Could not delete the application.", error);
            onAnnounce(t("jobs.error.save"));
        }
    };

    const status = {
        idle: null,
        pending: t("jobs.save.pending"),
        saving: t("jobs.save.saving"),
        saved: t("jobs.save.saved"),
        invalid: t("jobs.save.invalid"),
        failed: t("jobs.error.save"),
        conflict: null,
    }[saveState];

    return (
        <div className="fixed inset-0 z-[190] flex justify-end">
            <div className="absolute inset-0 bg-surface-2/60 backdrop-blur-sm" onClick={flushAndClose} />
            <div
                ref={ref}
                role="dialog"
                aria-modal="true"
                aria-labelledby="job-details-title"
                className="relative flex h-[100dvh] w-full flex-col border-l border-edge bg-surface-1 shadow-2xl md:max-w-3xl"
                data-testid="job-details"
            >
                <header className="border-b border-edge px-4 pb-3 pt-4 sm:px-6">
                    <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                            <h2 id="job-details-title" className="break-words text-lg font-bold text-strong">{application.role}</h2>
                            <p className="break-words text-sm text-mid">{application.company}</p>
                        </div>
                        <button type="button" onClick={flushAndClose} aria-label={t("common.close")} data-testid="job-details-close" className="rounded-lg p-2 text-faint hover:text-strong">
                            <X className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        {!trashed && (
                            <StageMenu
                                application={application}
                                testId="job-details-stage"
                                onChange={(stage: ApplicationStage) => void act((current, ctx) => changeStage(current, stage, ctx), t("jobs.announce.moved", { job: title, stage: stageLabel(stage) }))}
                            />
                        )}
                        {trashed && <span className="rounded-lg bg-danger-tint px-2 py-1 text-xs font-medium text-danger-soft">{t("jobs.inTrash")}</span>}
                        {application.archivedAt !== null && !trashed && <span className="rounded-lg bg-surface-4 px-2 py-1 text-xs font-medium text-mid">{t("jobs.archivedBadge")}</span>}
                        {application.jobUrl && isSafeWebUrl(application.jobUrl) && (
                            <a href={application.jobUrl} target="_blank" rel="noopener noreferrer nofollow" referrerPolicy="no-referrer" className={BUTTON_CLASS} data-testid="job-details-open-link">
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                {t("jobs.openLink")}
                            </a>
                        )}
                        {!trashed && application.submissions.length === 0 && tab !== "documents" && (
                            <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setTab("documents")} data-testid="job-details-prepare">
                                <FileText className="h-4 w-4" aria-hidden="true" />
                                {t("jobs.prepare")}
                            </button>
                        )}
                        <div className="ml-auto flex flex-wrap gap-2">
                            {trashed ? (
                                <>
                                    <button type="button" className={BUTTON_CLASS} data-testid="job-details-restore" onClick={() => void act((current, ctx) => restore(current, ctx), t("jobs.announce.restored", { job: title }))}>
                                        <RotateCcw className="h-4 w-4" aria-hidden="true" />{t("jobs.action.restore")}
                                    </button>
                                    <button type="button" className={`${BUTTON_CLASS} text-danger`} data-testid="job-details-delete" onClick={() => setConfirmDelete(true)}>
                                        <Trash2 className="h-4 w-4" aria-hidden="true" />{t("jobs.action.deleteForever")}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button type="button" className={BUTTON_CLASS} data-testid="job-details-duplicate" onClick={() => void handleDuplicate()}>
                                        <Copy className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{t("jobs.action.duplicate")}</span><span className="sr-only sm:hidden">{t("jobs.action.duplicate")}</span>
                                    </button>
                                    {application.archivedAt === null ? (
                                        <button type="button" className={BUTTON_CLASS} data-testid="job-details-archive" onClick={() => void act((current, ctx) => archive(current, ctx), t("jobs.announce.archived", { job: title }))}>
                                            <Archive className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{t("jobs.action.archive")}</span><span className="sr-only sm:hidden">{t("jobs.action.archive")}</span>
                                        </button>
                                    ) : (
                                        <button type="button" className={BUTTON_CLASS} data-testid="job-details-unarchive" onClick={() => void act((current, ctx) => unarchive(current, ctx), t("jobs.announce.unarchived", { job: title }))}>
                                            <ArchiveRestore className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{t("jobs.action.unarchive")}</span><span className="sr-only sm:hidden">{t("jobs.action.unarchive")}</span>
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className={BUTTON_CLASS}
                                        data-testid="job-details-trash"
                                        onClick={async () => {
                                            if (await act((current, ctx) => trash(current, ctx), t("jobs.announce.trashed", { job: title }))) onClose();
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{t("jobs.action.trash")}</span><span className="sr-only sm:hidden">{t("jobs.action.trash")}</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    <div role="tablist" aria-label={t("jobs.details.sections")} className="mt-4 flex gap-1">
                        {DETAILS_TABS.map((id) => (
                            <button
                                key={id}
                                type="button"
                                role="tab"
                                id={`job-tab-${id}`}
                                aria-selected={tab === id}
                                aria-controls={`job-panel-${id}`}
                                tabIndex={tab === id ? 0 : -1}
                                onClick={() => setTab(id)}
                                onKeyDown={(event) => {
                                    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                                        const step = event.key === "ArrowRight" ? 1 : DETAILS_TABS.length - 1;
                                        const next = DETAILS_TABS[(DETAILS_TABS.indexOf(id) + step) % DETAILS_TABS.length];
                                        setTab(next);
                                        document.getElementById(`job-tab-${next}`)?.focus();
                                    }
                                }}
                                data-testid={`job-tab-${id}`}
                                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === id ? "bg-surface-4 text-strong" : "text-mid hover:text-strong"}`}
                            >
                                {t(`jobs.details.${id}`)}
                            </button>
                        ))}
                        <p role="status" aria-live="polite" className="ml-auto self-center text-xs text-faint" data-testid="job-details-save-state">{status}</p>
                    </div>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
                    {saveState === "conflict" && (
                        <div role="alert" className="mb-4 rounded-xl border border-warning-tint2 bg-warning-tint p-3 text-sm text-strong" data-testid="job-details-conflict">
                            <p>{t("jobs.conflict.message")}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    className={BUTTON_CLASS}
                                    data-testid="job-details-reapply"
                                    onClick={() => {
                                        revision.current = application.revision;
                                        void save(form);
                                    }}
                                >
                                    {t("jobs.conflict.reapply")}
                                </button>
                                <button
                                    type="button"
                                    className={BUTTON_CLASS}
                                    data-testid="job-details-discard"
                                    onClick={() => {
                                        setDraft(null);
                                        setSaveState("idle");
                                        setErrors({});
                                    }}
                                >
                                    {t("jobs.conflict.discard")}
                                </button>
                            </div>
                        </div>
                    )}
                    {tab === "overview" ? (
                        <div id="job-panel-overview" role="tabpanel" aria-labelledby="job-tab-overview">
                            <DocumentsSummary application={application} onManage={() => setTab("documents")} />
                            <fieldset disabled={trashed} className="space-y-5">
                                <EssentialFields form={form} errors={errors} onChange={change} idPrefix="job-details" />
                                <div>
                                    <label htmlFor="job-details-notesMarkdown" className={LABEL_CLASS}>{t("jobs.field.notes")}</label>
                                    <textarea
                                        id="job-details-notesMarkdown"
                                        value={form.notesMarkdown}
                                        onChange={(event) => change("notesMarkdown", event.target.value)}
                                        placeholder={t("jobs.field.notesHint")}
                                        data-testid="job-details-notesMarkdown"
                                        className={TEXTAREA_CLASS}
                                    />
                                </div>
                                <MoreFields form={form} errors={errors} onChange={change} idPrefix="job-details" />
                            </fieldset>
                        </div>
                    ) : tab === "documents" ? (
                        <div id="job-panel-documents" role="tabpanel" aria-labelledby="job-tab-documents">
                            <ApplicationDocuments application={application} onAnnounce={onAnnounce} />
                        </div>
                    ) : (
                        <div id="job-panel-activity" role="tabpanel" aria-labelledby="job-tab-activity">
                            <ActivityList events={application.events} />
                        </div>
                    )}
                </div>
            </div>
            <ConfirmModal
                open={confirmDelete}
                title={t("jobs.delete.title")}
                description={t("jobs.delete.description", { job: title })}
                confirmLabel={t("jobs.action.deleteForever")}
                destructive
                onConfirm={() => void handleDelete()}
                onCancel={() => setConfirmDelete(false)}
            />
        </div>
    );
}

function ActivityList({ events }: { events: readonly ApplicationEvent[] }) {
    const { t, locale } = useTranslation();
    const stageLabel = useStageLabel();
    const format = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }), [locale]);
    const formatDay = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }), [locale]);
    const describe = (event: ApplicationEvent): string => {
        switch (event.type) {
            case "created": return t(event.duplicatedFrom ? "jobs.event.duplicated" : "jobs.event.created");
            case "stage-changed": return t("jobs.event.stage", { from: stageLabel(event.from), to: stageLabel(event.to) });
            case "submission-recorded": return t("jobs.event.submission");
            case "task-completed": return t("jobs.event.taskCompleted");
            case "task-cancelled": return t("jobs.event.taskCancelled");
            case "interview-changed": return t("jobs.event.interview");
            case "note": return event.text;
            case "archived": return t("jobs.event.archived");
            case "unarchived": return t("jobs.event.unarchived");
            case "trashed": return t("jobs.event.trashed");
            case "restored": return t("jobs.event.restored");
            case "correction": return t("jobs.event.correction");
        }
    };
    const ordered = [...events].sort((a, b) => b.recordedAt - a.recordedAt);
    return (
        <ol className="space-y-3" data-testid="job-activity">
            {ordered.map((event) => (
                <li key={event.id} className="rounded-xl border border-edge bg-surface-2 px-3 py-2">
                    <p className="text-sm text-strong">{describe(event)}</p>
                    <p className="mt-0.5 text-xs text-faint">
                        <time dateTime={new Date(event.recordedAt).toISOString()}>{format.format(event.recordedAt)}</time>
                        {event.occurredOn && <> · {t("jobs.event.occurredOn", { date: formatDay.format(Date.parse(`${event.occurredOn}T00:00:00Z`)) })}</>}
                    </p>
                </li>
            ))}
        </ol>
    );
}

/**
 * The working CV and letter at the top of the Overview, so linking them is never hidden behind a tab.
 * These are documents being worked on, not a record of what was sent.
 */
function DocumentsSummary({ application, onManage }: { application: JobApplication; onManage: () => void }) {
    const { t } = useTranslation();
    const { cvs, letters } = useDocumentChoices(t("dashboard.untitled"));
    const name = (id: string | null, choices: { id: string; title: string }[] | undefined) => {
        if (!id) return null;
        return choices?.find((choice) => choice.id === id)?.title ?? (choices ? t("jobs.documents.missing") : "…");
    };
    const cv = name(application.workingCvId, cvs);
    const letter = name(application.workingLetterId, letters);
    return (
        <div className="mb-5 flex flex-col gap-3 rounded-xl border border-edge bg-surface-2 p-3 sm:flex-row sm:items-center" data-testid="documents-summary">
            <dl className="grid min-w-0 flex-1 gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
                <dt className="flex items-center gap-1.5 text-faint"><FileText className="h-3.5 w-3.5" aria-hidden="true" />{t("jobs.documents.cv")}</dt>
                <dd className={`break-words ${cv ? "text-strong" : "text-mid"}`}>{cv ?? t("jobs.documents.none")}</dd>
                <dt className="flex items-center gap-1.5 text-faint"><Mail className="h-3.5 w-3.5" aria-hidden="true" />{t("jobs.documents.letter")}</dt>
                <dd className={`break-words ${letter ? "text-strong" : "text-mid"}`}>{letter ?? t("jobs.documents.none")}</dd>
            </dl>
            <button type="button" className={BUTTON_CLASS} onClick={onManage} data-testid="documents-summary-manage">
                {t(cv || letter ? "jobs.documents.manage" : "jobs.documents.linkDocuments")}
            </button>
        </div>
    );
}
