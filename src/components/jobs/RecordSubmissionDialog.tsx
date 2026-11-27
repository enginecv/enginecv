"use client";

import { AlertTriangle, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";
import { dateOnlyFormatter, localDateOnly } from "@/lib/jobs/dates";
import { StaleApplicationError } from "@/lib/jobs/repository";
import { SUBMISSION_CHANNELS, dateOnlySchema, type ApplicationSubmission, type JobApplication } from "@/lib/jobs/schema";
import { CaptureError, captureSubmission, type CaptureProblem, type SlotChoice } from "@/lib/jobs/submissions";
import type { CvChoice, LetterChoice } from "./useDocumentChoices";
import { BUTTON_CLASS, FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS } from "./shared";

type SlotMode = SlotChoice["kind"];
type Slot = "cv" | "letter";

function SlotPicker({ slot, mode, documentId, onMode, onDocument, choices, legend }: {
    slot: Slot;
    mode: SlotMode;
    documentId: string;
    onMode: (mode: SlotMode) => void;
    onDocument: (id: string) => void;
    choices: { id: string; title: string }[];
    legend: string;
}) {
    const { t } = useTranslation();
    const modes: SlotMode[] = ["document", "none", "unknown"];
    return (
        <fieldset className="rounded-xl border border-edge p-3" data-testid={`record-${slot}`}>
            <legend className="px-1 text-sm font-semibold text-strong">{legend}</legend>
            <div className="mt-1 space-y-1.5">
                {modes.map((option) => (
                    <label key={option} className="flex items-start gap-2 text-sm text-mid">
                        <input
                            type="radio"
                            name={`record-${slot}-mode`}
                            checked={mode === option}
                            onChange={() => onMode(option)}
                            disabled={option === "document" && choices.length === 0}
                            data-testid={`record-${slot}-${option}`}
                            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                        />
                        <span>{t(`jobs.record.mode.${option}`)}</span>
                    </label>
                ))}
            </div>
            {mode === "document" && (
                <select
                    aria-label={legend}
                    value={documentId}
                    onChange={(event) => onDocument(event.target.value)}
                    data-testid={`record-${slot}-select`}
                    className={`${FIELD_CLASS} mt-2`}
                >
                    {choices.map((choice) => <option key={choice.id} value={choice.id}>{choice.title}</option>)}
                </select>
            )}
        </fieldset>
    );
}

/**
 * "Record application": what was sent, when and how. Each slot is a document from this browser (copied
 * now, frozen), "none sent" or "not recorded". It records; it never sends anything and does not change
 * the working letter's status.
 */
export function RecordSubmissionDialog({ application, cvs, letters, onClose, onRecorded }: {
    application: JobApplication;
    cvs: CvChoice[];
    letters: LetterChoice[];
    onClose: () => void;
    onRecorded: (application: JobApplication) => void;
}) {
    const { t, locale } = useTranslation();
    const ref = useDialogFocus<HTMLDivElement>(true, onClose);
    const today = localDateOnly();
    const formatDay = useMemo(() => dateOnlyFormatter(locale), [locale]);
    const startDocument = (working: string | null, choices: { id: string }[]) => (working && choices.some((choice) => choice.id === working) ? working : choices[0]?.id ?? "");
    const [sentOn, setSentOn] = useState(today);
    const [channel, setChannel] = useState<ApplicationSubmission["channel"]>("website");
    const [reference, setReference] = useState("");
    const [cvMode, setCvMode] = useState<SlotMode>(application.workingCvId && cvs.some((cv) => cv.id === application.workingCvId) ? "document" : "unknown");
    const [cvId, setCvId] = useState(() => startDocument(application.workingCvId, cvs));
    const [letterMode, setLetterMode] = useState<SlotMode>(application.workingLetterId && letters.some((letter) => letter.id === application.workingLetterId) ? "document" : "unknown");
    const [letterId, setLetterId] = useState(() => startDocument(application.workingLetterId, letters));
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState<CaptureProblem | "stale" | "failed" | "date" | null>(null);

    const chosenLetter = letterMode === "document" ? letters.find((letter) => letter.id === letterId) : undefined;
    const mismatch = chosenLetter && !chosenLetter.standalone && chosenLetter.cvId && cvMode === "document" && chosenLetter.cvId !== cvId;
    const followedTitle = mismatch ? cvs.find((cv) => cv.id === chosenLetter.cvId)?.title ?? t("jobs.documents.deletedCv") : "";
    const historical = sentOn < today && (cvMode === "document" || letterMode === "document");

    const submit = async (override?: { cv?: SlotMode; letter?: SlotMode }) => {
        if (!dateOnlySchema.safeParse(sentOn).success) {
            setProblem("date");
            return;
        }
        const finalCv = override?.cv ?? cvMode;
        const finalLetter = override?.letter ?? letterMode;
        setBusy(true);
        setProblem(null);
        try {
            const saved = await captureSubmission(application.id, application.revision, {
                sentOn,
                sentAt: null,
                channel,
                reference: reference.trim() || null,
                cv: finalCv === "document" ? { kind: "document", id: cvId } : { kind: finalCv },
                letter: finalLetter === "document" ? { kind: "document", id: letterId } : { kind: finalLetter },
            });
            onRecorded(saved);
        } catch (error) {
            if (error instanceof CaptureError) setProblem(error.problem);
            else if (error instanceof StaleApplicationError) setProblem("stale");
            else {
                console.error("[EngineCV] Could not record the application.", error);
                setProblem("failed");
            }
            setBusy(false);
        }
    };

    // When one document cannot be copied, the application can still be recorded with that slot "not recorded".
    const fallback = problem === "cv-missing" ? { cv: "unknown" as const } : problem === "letter-missing" || problem === "letter-unresolved" ? { letter: "unknown" as const } : null;

    return (
        <div className="fixed inset-0 z-[220] flex items-end justify-center sm:items-center sm:p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={onClose} />
            <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="record-title" className="glass-panel relative flex max-h-[100dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl" data-testid="record-dialog">
                <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
                    <div className="flex items-start justify-between gap-3 px-5 pt-5">
                        <div>
                            <h2 id="record-title" className="text-lg font-bold text-strong">{t("jobs.record.title")}</h2>
                            <p className="mt-1 text-sm text-mid">{t("jobs.record.hint")}</p>
                        </div>
                        <button type="button" onClick={onClose} aria-label={t("dashboard.cancel")} className="rounded-lg p-2 text-faint hover:text-strong"><X className="h-4 w-4" aria-hidden="true" /></button>
                    </div>
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <label htmlFor="record-sent-on" className={LABEL_CLASS}>{t("jobs.record.sentOn")}</label>
                                <input id="record-sent-on" type="date" value={sentOn} max={today} onChange={(event) => setSentOn(event.target.value)} className={FIELD_CLASS} data-autofocus data-testid="record-sent-on" />
                            </div>
                            <div>
                                <label htmlFor="record-channel" className={LABEL_CLASS}>{t("jobs.record.channel")}</label>
                                <select id="record-channel" value={channel} onChange={(event) => setChannel(event.target.value as ApplicationSubmission["channel"])} className={FIELD_CLASS} data-testid="record-channel">
                                    {SUBMISSION_CHANNELS.map((option) => <option key={option} value={option}>{t(`jobs.channel.${option}`)}</option>)}
                                </select>
                            </div>
                            <div className="sm:col-span-2">
                                <label htmlFor="record-reference" className={LABEL_CLASS}>{t("jobs.record.reference")}</label>
                                <input id="record-reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder={t("jobs.record.referenceHint")} className={FIELD_CLASS} data-testid="record-reference" />
                            </div>
                        </div>
                        <SlotPicker slot="cv" legend={t("jobs.record.cv")} mode={cvMode} onMode={setCvMode} documentId={cvId} onDocument={setCvId} choices={cvs} />
                        <SlotPicker slot="letter" legend={t("jobs.record.letter")} mode={letterMode} onMode={setLetterMode} documentId={letterId} onDocument={setLetterId} choices={letters} />
                        {mismatch && (
                            <p className="flex items-start gap-2 rounded-xl border border-warning-tint2 bg-warning-tint p-3 text-sm text-strong" data-testid="record-mismatch">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                                {t("jobs.record.mismatch", { cv: followedTitle })}
                            </p>
                        )}
                        {historical && <p className="rounded-xl border border-edge bg-surface-3 p-3 text-sm text-mid" data-testid="record-historical">{t("jobs.record.historical", { date: formatDay(sentOn) })}</p>}
                        {problem && (
                            <div role="alert" className="rounded-xl border border-danger/40 bg-danger-tint p-3 text-sm text-strong" data-testid="record-error">
                                <p>{t(`jobs.record.error.${problem}`)}</p>
                                {fallback && <button type="button" className={`${BUTTON_CLASS} mt-3`} onClick={() => void submit(fallback)} data-testid="record-fallback">{t("jobs.record.recordWithout")}</button>}
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-2 border-t border-edge px-5 py-4">
                        <button type="button" onClick={onClose} className={BUTTON_CLASS}>{t("dashboard.cancel")}</button>
                        <button type="submit" disabled={busy} className={PRIMARY_BUTTON_CLASS} data-testid="record-save">
                            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                            {t("jobs.record.save")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
