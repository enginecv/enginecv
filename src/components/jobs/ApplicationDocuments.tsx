"use client";

import { AlertTriangle, Copy, ExternalLink, FileText, Link2, Mail, Plus, Send, Unlink } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { db } from "@/lib/db";
import { editorHrefFromJob } from "@/lib/dashboard-tab-url";
import { useTranslation } from "@/lib/i18n";
import { dateOnlyFormatter } from "@/lib/jobs/dates";
import { addCalendarDays, addTask, updateDetails } from "@/lib/jobs/operations";
import type { ApplicationSubmission, DocumentSelection, JobApplication } from "@/lib/jobs/schema";
import { readSubmissionPacket, type CapturedDocuments, type PacketReadResult } from "@/lib/jobs/submissions";
import { createLetterRecord, createStandaloneLetterRecord, parseCv } from "@/lib/letters/store";
import { duplicateResume } from "@/lib/resume-operations";
import { EvidenceDialog } from "./EvidenceDialog";
import { RecordSubmissionDialog } from "./RecordSubmissionDialog";
import { BUTTON_CLASS, FIELD_CLASS, PRIMARY_BUTTON_CLASS, runCommand, useCommandError } from "./shared";
import { useDocumentChoices, type CvChoice, type LetterChoice } from "./useDocumentChoices";

type Choice = CvChoice | LetterChoice;

/** A follow-up is suggested this many calendar days after a submission, and created only if accepted. */
const FOLLOW_UP_DAYS = 7;

function useUpdated() {
    const { locale } = useTranslation();
    return useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }), [locale]);
}

/** One working-document slot: linked (with its live state) or a picker to link one. */
function WorkingSlot({ kind, application, linked, choices, onLink, onUnlink, extraActions }: {
    kind: "cv" | "letter";
    application: JobApplication;
    linked: string | null;
    choices: Choice[] | undefined;
    onLink: (id: string) => void;
    onUnlink: () => void;
    extraActions: React.ReactNode;
}) {
    const { t } = useTranslation();
    const updated = useUpdated();
    const [picked, setPicked] = useState("");
    const [changing, setChanging] = useState(false);
    const Icon = kind === "cv" ? FileText : Mail;
    const label = t(kind === "cv" ? "jobs.documents.cv" : "jobs.documents.letter");
    const document = linked ? choices?.find((choice) => choice.id === linked) : undefined;
    const missing = linked !== null && choices !== undefined && !document;
    const editorPath = kind === "cv" ? `/editor/${linked}` : `/letters/${linked}`;
    const options = choices ?? [];
    const selectValue = picked || options[0]?.id || "";

    return (
        <div className="rounded-xl border border-edge bg-surface-2 p-3" data-testid={`working-${kind}`}>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-faint">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}
            </p>
            {linked && !changing ? (
                <div className="mt-2">
                    {document ? (
                        <>
                            <p className="break-words text-sm font-semibold text-strong" data-testid={`working-${kind}-title`}>{document.title}</p>
                            <p className="text-xs text-faint">
                                {[document.language.toUpperCase(), t("jobs.documents.updated", { date: updated.format(document.updatedAt) }), "status" in document && document.status !== "draft" ? t(`jobs.documents.letterStatus.${document.status}`) : null].filter(Boolean).join(" · ")}
                            </p>
                        </>
                    ) : missing ? (
                        <p className="flex items-center gap-1.5 text-sm text-warning" data-testid={`working-${kind}-missing`}>
                            <AlertTriangle className="h-4 w-4" aria-hidden="true" />{t("jobs.documents.missing")}
                        </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                        {document && (
                            <Link href={editorHrefFromJob(editorPath, application.id)} className={BUTTON_CLASS} data-testid={`working-${kind}-open`}>
                                <ExternalLink className="h-4 w-4" aria-hidden="true" />{t("jobs.documents.open")}
                            </Link>
                        )}
                        <button type="button" className={BUTTON_CLASS} onClick={() => { setPicked(linked); setChanging(true); }} data-testid={`working-${kind}-change`}>
                            <Link2 className="h-4 w-4" aria-hidden="true" />{t("jobs.documents.change")}
                        </button>
                        <button type="button" className={BUTTON_CLASS} onClick={onUnlink} data-testid={`working-${kind}-unlink`}>
                            <Unlink className="h-4 w-4" aria-hidden="true" />{t("jobs.documents.unlink")}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="mt-2 space-y-2">
                    {options.length > 0 ? (
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <select aria-label={t(kind === "cv" ? "jobs.documents.pickCv" : "jobs.documents.pickLetter")} value={selectValue} onChange={(event) => setPicked(event.target.value)} className={`${FIELD_CLASS} sm:flex-1`} data-testid={`working-${kind}-select`}>
                                {options.map((choice) => (
                                    <option key={choice.id} value={choice.id}>
                                        {choice.title}{choice.language ? ` (${choice.language.toUpperCase()})` : ""}
                                    </option>
                                ))}
                            </select>
                            <button type="button" className={PRIMARY_BUTTON_CLASS} disabled={!selectValue} onClick={() => { onLink(selectValue); setChanging(false); setPicked(""); }} data-testid={`working-${kind}-link`}>
                                <Link2 className="h-4 w-4" aria-hidden="true" />{t("jobs.documents.link")}
                            </button>
                        </div>
                    ) : (
                        <p className="text-sm text-mid">{t(kind === "cv" ? "jobs.documents.noCvs" : "jobs.documents.noLetters")}</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                        {extraActions}
                        {changing && <button type="button" className={BUTTON_CLASS} onClick={() => setChanging(false)}>{t("dashboard.cancel")}</button>}
                    </div>
                </div>
            )}
        </div>
    );
}

function selectionText(selection: DocumentSelection, t: (key: string, params?: Record<string, string>) => string): string {
    if (selection.status === "captured") return selection.capturedTitle || t("dashboard.untitled");
    return t(`jobs.submission.${selection.status}`);
}

function SubmissionRow({ application, submission, cvs, letters, onView }: {
    application: JobApplication;
    submission: ApplicationSubmission;
    cvs: CvChoice[] | undefined;
    letters: LetterChoice[] | undefined;
    onView: (documents: CapturedDocuments) => void;
}) {
    const { t, locale } = useTranslation();
    const formatDay = useMemo(() => dateOnlyFormatter(locale), [locale]);
    const [state, setState] = useState<PacketReadResult | "loading" | null>(null);
    const hasCopies = submission.packetId !== null;

    const view = async () => {
        setState("loading");
        const result = await readSubmissionPacket(application.id, submission);
        setState(result);
        if (result.status === "available") onView(result.documents);
    };

    const sourceNote = (selection: DocumentSelection, choices: Choice[] | undefined) => {
        if (selection.status !== "captured" || !selection.sourceId || !choices) return null;
        const live = choices.find((choice) => choice.id === selection.sourceId);
        if (!live) return t("jobs.submission.originalDeleted");
        if (live.title !== selection.capturedTitle) return t("jobs.submission.originalRenamed", { title: live.title });
        return null;
    };

    return (
        <li className="rounded-xl border border-edge bg-surface-2 p-3" data-testid="submission">
            <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-strong">
                <Send className="h-4 w-4 text-faint" aria-hidden="true" />
                {t("jobs.submission.sent", { date: formatDay(submission.sentOn) })}
                <span className="font-normal text-mid">· {t(`jobs.channel.${submission.channel}`)}</span>
                {submission.reference && <span className="font-normal text-mid">· {submission.reference}</span>}
            </p>
            <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-3">
                {([["cv", submission.cv, cvs], ["letter", submission.letter, letters]] as const).map(([slot, selection, choices]) => {
                    const note = sourceNote(selection, choices);
                    return (
                        <div key={slot} className="contents">
                            <dt className="text-faint">{t(slot === "cv" ? "jobs.record.cv" : "jobs.record.letter")}</dt>
                            <dd className="break-words text-strong" data-testid={`submission-${slot}`}>
                                {selectionText(selection, t)}
                                {note && <span className="ml-2 text-xs text-faint" data-testid={`submission-${slot}-note`}>({note})</span>}
                            </dd>
                        </div>
                    );
                })}
            </dl>
            {hasCopies && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button type="button" className={BUTTON_CLASS} onClick={() => void view()} disabled={state === "loading"} data-testid="submission-view">{t("jobs.submission.view")}</button>
                    {state && state !== "loading" && state.status === "missing" && <p className="text-sm text-warning" data-testid="submission-packet-missing">{t("jobs.submission.packetMissing")}</p>}
                    {state && state !== "loading" && state.status === "invalid" && <p className="text-sm text-danger" data-testid="submission-packet-invalid">{t("jobs.submission.packetInvalid")}</p>}
                </div>
            )}
        </li>
    );
}

/**
 * The Documents tab: the CV and letter being worked on for this job (links, editable elsewhere), apart
 * from the submission history (frozen copies of what was sent). A linked letter is never shown as sent.
 */
export function ApplicationDocuments({ application, onAnnounce }: { application: JobApplication; onAnnounce: (message: string) => void }) {
    const { t, locale } = useTranslation();
    const formatDay = useMemo(() => dateOnlyFormatter(locale), [locale]);
    const commandError = useCommandError();
    const { cvs, letters } = useDocumentChoices(t("dashboard.untitled"));
    const [recording, setRecording] = useState(false);
    const [viewing, setViewing] = useState<CapturedDocuments | null>(null);
    const [followUp, setFollowUp] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const trashed = application.trashedAt !== null;

    const link = async (patch: Partial<Pick<JobApplication, "workingCvId" | "workingLetterId">>, message: string) => {
        const outcome = await runCommand(application, (current) => updateDetails(current, patch));
        onAnnounce(outcome.ok ? message : commandError(outcome.reason));
    };

    const workingLetter = letters?.find((letter) => letter.id === application.workingLetterId);
    const letterFollowsOther = workingLetter && !workingLetter.standalone && workingLetter.cvId && application.workingCvId && workingLetter.cvId !== application.workingCvId;

    const duplicateForJob = async () => {
        const sourceId = application.workingCvId ?? cvs?.[0]?.id;
        if (!sourceId) return;
        setBusy(true);
        try {
            const source = parseCv(await db.resumes.get(sourceId));
            if (!source) throw new Error("CV not found");
            const id = await duplicateResume(source, application.company);
            await link({ workingCvId: id }, t("jobs.documents.duplicated"));
        } catch (error) {
            console.error("[EngineCV] Could not duplicate the CV.", error);
            onAnnounce(t("jobs.error.save"));
        } finally {
            setBusy(false);
        }
    };

    const createLetter = async () => {
        setBusy(true);
        try {
            const options = { company: application.company, role: application.role };
            const letter = application.workingCvId && cvs?.some((cv) => cv.id === application.workingCvId)
                ? await createLetterRecord(application.workingCvId, options)
                : await createStandaloneLetterRecord({ ...options, language: cvs?.[0]?.language || "en" });
            await link({ workingLetterId: letter.id }, t("jobs.documents.letterCreated"));
        } catch (error) {
            console.error("[EngineCV] Could not create the letter.", error);
            onAnnounce(t("jobs.error.save"));
        } finally {
            setBusy(false);
        }
    };

    const submissions = [...application.submissions].sort((a, b) => b.sentOn.localeCompare(a.sentOn) || b.recordedAt - a.recordedAt);

    return (
        <div className="space-y-6" data-testid="job-documents">
            <section aria-labelledby="working-heading">
                <h3 id="working-heading" className="text-sm font-semibold text-strong">{t("jobs.documents.working")}</h3>
                <p className="mt-1 text-sm text-mid">{t("jobs.documents.workingHint")}</p>
                <fieldset disabled={trashed || busy} className="mt-3 grid gap-3 md:grid-cols-2">
                    <WorkingSlot
                        kind="cv"
                        application={application}
                        linked={application.workingCvId}
                        choices={cvs}
                        onLink={(id) => void link({ workingCvId: id }, t("jobs.documents.linked"))}
                        onUnlink={() => void link({ workingCvId: null }, t("jobs.documents.unlinked"))}
                        extraActions={cvs && cvs.length > 0 && (
                            <button type="button" className={BUTTON_CLASS} onClick={() => void duplicateForJob()} data-testid="working-cv-duplicate">
                                <Copy className="h-4 w-4" aria-hidden="true" />{t("jobs.documents.duplicateCv")}
                            </button>
                        )}
                    />
                    <WorkingSlot
                        kind="letter"
                        application={application}
                        linked={application.workingLetterId}
                        choices={letters}
                        onLink={(id) => void link({ workingLetterId: id }, t("jobs.documents.linked"))}
                        onUnlink={() => void link({ workingLetterId: null }, t("jobs.documents.unlinked"))}
                        extraActions={(
                            <button type="button" className={BUTTON_CLASS} onClick={() => void createLetter()} data-testid="working-letter-create">
                                <Plus className="h-4 w-4" aria-hidden="true" />{t("jobs.documents.createLetter")}
                            </button>
                        )}
                    />
                </fieldset>
                {letterFollowsOther && (
                    <p className="mt-3 flex items-start gap-2 rounded-xl border border-warning-tint2 bg-warning-tint p-3 text-sm text-strong" data-testid="working-mismatch">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                        {t("jobs.documents.mismatch", { cv: cvs?.find((cv) => cv.id === workingLetter.cvId)?.title ?? t("jobs.documents.deletedCv") })}
                    </p>
                )}
            </section>

            {followUp && (
                <div role="status" className="flex flex-col gap-3 rounded-xl border border-edge bg-surface-3 p-3 text-sm text-strong sm:flex-row sm:items-center" data-testid="follow-up-offer">
                    <p className="min-w-0 flex-1">{t("jobs.followUp.offer", { date: formatDay(followUp) })}</p>
                    <div className="flex gap-2">
                        <button type="button" className={PRIMARY_BUTTON_CLASS} data-testid="follow-up-add" onClick={async () => {
                            const date = followUp;
                            setFollowUp(null);
                            const outcome = await runCommand(application, (current, ctx) => addTask(current, { title: t("jobs.followUp.title", { company: current.company }), dueOn: date }, ctx));
                            onAnnounce(outcome.ok ? t("jobs.followUp.added") : commandError(outcome.reason));
                        }}>{t("jobs.followUp.add")}</button>
                        <button type="button" className={BUTTON_CLASS} onClick={() => setFollowUp(null)} data-testid="follow-up-skip">{t("jobs.followUp.skip")}</button>
                    </div>
                </div>
            )}

            <section aria-labelledby="history-heading">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 id="history-heading" className="text-sm font-semibold text-strong">{t("jobs.submission.history")}</h3>
                    {!trashed && cvs && letters && (
                        <button type="button" className={PRIMARY_BUTTON_CLASS} onClick={() => setRecording(true)} data-testid="record-open">
                            <Send className="h-4 w-4" aria-hidden="true" />{t("jobs.record.title")}
                        </button>
                    )}
                </div>
                {submissions.length === 0 ? (
                    <p className="mt-2 text-sm text-mid" data-testid="submission-empty">{t("jobs.submission.empty")}</p>
                ) : (
                    <ol className="mt-3 space-y-3">
                        {submissions.map((submission) => <SubmissionRow key={submission.id} application={application} submission={submission} cvs={cvs} letters={letters} onView={setViewing} />)}
                    </ol>
                )}
            </section>

            {recording && cvs && letters && (
                <RecordSubmissionDialog
                    application={application}
                    cvs={cvs}
                    letters={letters}
                    onClose={() => setRecording(false)}
                    onRecorded={(saved) => {
                        setRecording(false);
                        onAnnounce(t("jobs.announce.recorded"));
                        const sentOn = saved.submissions.at(-1)?.sentOn;
                        if (sentOn) setFollowUp(addCalendarDays(sentOn, FOLLOW_UP_DAYS));
                    }}
                />
            )}
            {viewing && <EvidenceDialog documents={viewing} onClose={() => setViewing(null)} />}
        </div>
    );
}
