"use client";

import { AlertTriangle, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";
import { instantFromWallTime, knownTimeZones, viewerTimeZone, wallTimeIn } from "@/lib/jobs/dates";
import type { InterviewInput } from "@/lib/jobs/operations";
import { INTERVIEW_OUTCOMES, isSafeWebUrl, isTerminalStage, isValidTimeZone, type ApplicationInterview, type JobApplication } from "@/lib/jobs/schema";
import { BUTTON_CLASS, FIELD_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS, TEXTAREA_CLASS } from "./shared";

type Problem = "label" | "date" | "start" | "end" | "order" | "nonexistent" | "link" | "zone";

/**
 * Adds or edits an interview round. The date and times are wall-clock values in the chosen zone; they are
 * stored as UTC instants with that zone, so a later move to another zone shows the same moment. A time
 * the clock skips is refused; a time it passes twice asks which one.
 */
export function InterviewDialog({ application, interview, onClose, onSave }: {
    application: JobApplication;
    interview: ApplicationInterview | null;
    onClose: () => void;
    onSave: (input: InterviewInput, options: { reopen: boolean }) => Promise<boolean>;
}) {
    const { t, locale } = useTranslation();
    const ref = useDialogFocus<HTMLDivElement>(true, onClose);
    const zones = useMemo(() => knownTimeZones(), []);
    const initialZone = interview?.timeZone ?? viewerTimeZone();
    const startWall = interview?.startsAt != null ? wallTimeIn(interview.startsAt, initialZone) : null;
    const endWall = interview?.endsAt != null ? wallTimeIn(interview.endsAt, initialZone) : null;

    const [label, setLabel] = useState(interview?.label ?? t("jobs.interview.defaultLabel", { number: application.interviews.length + 1 }));
    const [date, setDate] = useState(startWall?.date ?? "");
    const [start, setStart] = useState(startWall?.time ?? "");
    const [end, setEnd] = useState(endWall?.time ?? "");
    const [timeZone, setTimeZone] = useState(initialZone);
    const [location, setLocation] = useState(interview?.location ?? "");
    const [link, setLink] = useState(interview?.link ?? "");
    const [contactIds, setContactIds] = useState<string[]>(interview?.contactIds ?? []);
    const [notes, setNotes] = useState(interview?.notes ?? "");
    const [outcome, setOutcome] = useState<ApplicationInterview["outcome"]>(interview?.outcome ?? "scheduled");
    const [fold, setFold] = useState<"earlier" | "later">("earlier");
    const [reopen, setReopen] = useState(false);
    const [problem, setProblem] = useState<Problem | null>(null);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);

    const resolve = (time: string) => (date && time ? instantFromWallTime(date, time, timeZone) : null);
    const startResult = resolve(start);
    const endResult = resolve(end);
    const ambiguous = startResult?.status === "ambiguous" ? startResult : endResult?.status === "ambiguous" ? endResult : null;
    const closed = isTerminalStage(application.stage) && interview === null;
    const offsetLabel = (instant: number) => new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", timeZoneName: "short" }).format(instant);

    const pick = (result: ReturnType<typeof resolve>): number | null | "nonexistent" => {
        if (!result) return null;
        if (result.status === "nonexistent") return "nonexistent";
        if (result.status === "ambiguous") return result.instants[fold === "earlier" ? 0 : 1];
        return result.instant;
    };

    const submit = async () => {
        let found: Problem | null = null;
        if (!label.trim()) found = "label";
        else if (!isValidTimeZone(timeZone)) found = "zone";
        else if ((start || end) && !date) found = "date";
        else if (end && !start) found = "start";
        else if (link.trim() && !isSafeWebUrl(link.trim())) found = "link";
        const startsAt = pick(startResult);
        const endsAt = pick(endResult);
        if (!found && (startsAt === "nonexistent" || endsAt === "nonexistent")) found = "nonexistent";
        if (!found && typeof startsAt === "number" && typeof endsAt === "number" && endsAt <= startsAt) found = "order";
        setProblem(found);
        if (found) return;
        setBusy(true);
        setFailed(false);
        const ok = await onSave({
            label: label.trim(),
            startsAt: startsAt as number | null,
            endsAt: endsAt as number | null,
            timeZone,
            location: location.trim() || null,
            link: link.trim() || null,
            contactIds,
            notes,
            outcome,
        }, { reopen });
        if (!ok) {
            setFailed(true);
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[220] flex items-end justify-center sm:items-center sm:p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={onClose} />
            <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="interview-title" className="glass-panel relative flex max-h-[100dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl" data-testid="interview-dialog">
                <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
                    <div className="flex items-start justify-between gap-3 px-5 pt-5">
                        <h2 id="interview-title" className="text-lg font-bold text-strong">{t(interview ? "jobs.interview.edit" : "jobs.interview.add")}</h2>
                        <button type="button" onClick={onClose} aria-label={t("dashboard.cancel")} className="rounded-lg p-2 text-faint hover:text-strong"><X className="h-4 w-4" aria-hidden="true" /></button>
                    </div>
                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
                        <div>
                            <label htmlFor="interview-label" className={LABEL_CLASS}>{t("jobs.interview.label")}</label>
                            <input id="interview-label" value={label} onChange={(event) => setLabel(event.target.value)} className={FIELD_CLASS} data-autofocus data-testid="interview-label" />
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <div className="col-span-2 sm:col-span-1">
                                <label htmlFor="interview-date" className={LABEL_CLASS}>{t("jobs.interview.date")}</label>
                                <input id="interview-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={FIELD_CLASS} data-testid="interview-date" />
                            </div>
                            <div>
                                <label htmlFor="interview-start" className={LABEL_CLASS}>{t("jobs.interview.start")}</label>
                                <input id="interview-start" type="time" value={start} onChange={(event) => setStart(event.target.value)} className={FIELD_CLASS} data-testid="interview-start" />
                            </div>
                            <div>
                                <label htmlFor="interview-end" className={LABEL_CLASS}>{t("jobs.interview.end")}</label>
                                <input id="interview-end" type="time" value={end} onChange={(event) => setEnd(event.target.value)} className={FIELD_CLASS} data-testid="interview-end" />
                            </div>
                        </div>
                        <p className="text-xs text-faint">{t("jobs.interview.timeHint")}</p>
                        <div>
                            <label htmlFor="interview-zone" className={LABEL_CLASS}>{t("jobs.interview.timeZone")}</label>
                            <select id="interview-zone" value={timeZone} onChange={(event) => setTimeZone(event.target.value)} className={FIELD_CLASS} data-testid="interview-zone">
                                {(zones.includes(timeZone) ? zones : [timeZone, ...zones]).map((zone) => <option key={zone} value={zone}>{zone.replace(/_/g, " ")}</option>)}
                            </select>
                        </div>
                        {ambiguous && (
                            <fieldset className="rounded-xl border border-warning-tint2 bg-warning-tint p-3 text-sm text-strong" data-testid="interview-ambiguous">
                                <legend className="sr-only">{t("jobs.interview.ambiguous")}</legend>
                                <p className="mb-2">{t("jobs.interview.ambiguous")}</p>
                                {(["earlier", "later"] as const).map((option, index) => (
                                    <label key={option} className="flex items-center gap-2">
                                        <input type="radio" name="interview-fold" checked={fold === option} onChange={() => setFold(option)} className="h-4 w-4 accent-[var(--accent)]" />
                                        {offsetLabel(ambiguous.instants[index])}
                                    </label>
                                ))}
                            </fieldset>
                        )}
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                                <label htmlFor="interview-location" className={LABEL_CLASS}>{t("jobs.interview.location")}</label>
                                <input id="interview-location" value={location} onChange={(event) => setLocation(event.target.value)} className={FIELD_CLASS} data-testid="interview-location" />
                            </div>
                            <div>
                                <label htmlFor="interview-link" className={LABEL_CLASS}>{t("jobs.interview.link")}</label>
                                <input id="interview-link" type="url" value={link} onChange={(event) => setLink(event.target.value)} className={FIELD_CLASS} data-testid="interview-link" />
                            </div>
                        </div>
                        {application.contacts.length > 0 && (
                            <fieldset>
                                <legend className={LABEL_CLASS}>{t("jobs.interview.contacts")}</legend>
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
                                    {application.contacts.map((contact) => (
                                        <label key={contact.id} className="flex items-center gap-2 text-sm text-mid">
                                            <input type="checkbox" checked={contactIds.includes(contact.id)} onChange={() => setContactIds((ids) => (ids.includes(contact.id) ? ids.filter((id) => id !== contact.id) : [...ids, contact.id]))} className="h-4 w-4 accent-[var(--accent)]" />
                                            {contact.name}
                                        </label>
                                    ))}
                                </div>
                            </fieldset>
                        )}
                        <div>
                            <label htmlFor="interview-notes" className={LABEL_CLASS}>{t("jobs.interview.notes")}</label>
                            <textarea id="interview-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t("jobs.interview.notesHint")} className={TEXTAREA_CLASS} data-testid="interview-notes" />
                        </div>
                        <div>
                            <label htmlFor="interview-outcome" className={LABEL_CLASS}>{t("jobs.interview.outcome")}</label>
                            <select id="interview-outcome" value={outcome} onChange={(event) => setOutcome(event.target.value as ApplicationInterview["outcome"])} className={FIELD_CLASS} data-testid="interview-outcome">
                                {INTERVIEW_OUTCOMES.map((option) => <option key={option} value={option}>{t(`jobs.interview.outcomeValue.${option}`)}</option>)}
                            </select>
                        </div>
                        {closed && (
                            <label className="flex items-start gap-2 rounded-xl border border-edge bg-surface-3 p-3 text-sm text-mid">
                                <input type="checkbox" checked={reopen} onChange={(event) => setReopen(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" data-testid="interview-reopen" />
                                {t("jobs.interview.reopen")}
                            </label>
                        )}
                        {problem && (
                            <p role="alert" className="flex items-start gap-2 text-sm text-danger" data-testid="interview-error">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{t(`jobs.interview.error.${problem}`)}
                            </p>
                        )}
                        {failed && <p role="alert" className="text-sm text-danger">{t("jobs.error.save")}</p>}
                    </div>
                    <div className="flex justify-end gap-2 border-t border-edge px-5 py-4">
                        <button type="button" onClick={onClose} className={BUTTON_CLASS}>{t("dashboard.cancel")}</button>
                        <button type="submit" disabled={busy} className={PRIMARY_BUTTON_CLASS} data-testid="interview-save">{t("jobs.interview.save")}</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
