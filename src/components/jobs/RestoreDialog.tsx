"use client";

import { Loader2, X } from "lucide-react";
import { useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";
import { parseTrackerBackup, type BackupProblem, type TrackerBackup } from "@/lib/jobs/backup";
import { RestoreConflictError, previewRestore, restoreTrackerBackup, type CollisionChoice, type RestorePreview } from "@/lib/jobs/restore";
import { BUTTON_CLASS, FIELD_CLASS, PRIMARY_BUTTON_CLASS, applicationTitle } from "./shared";

const MAX_BACKUP_BYTES = 200 * 1024 * 1024;

/**
 * Restore from a tracker backup file: read and check it whole, preview what would change, then write it
 * in one step. Nothing is written until the person confirms; colliding jobs are skipped unless chosen.
 */
export function RestoreDialog({ onClose, onAnnounce }: { onClose: () => void; onAnnounce: (message: string) => void }) {
    const { t } = useTranslation();
    const ref = useDialogFocus<HTMLDivElement>(true, onClose);
    const [state, setState] = useState<
        | { step: "pick" }
        | { step: "reading" }
        | { step: "problems"; problems: BackupProblem[] }
        | { step: "preview"; backup: TrackerBackup; preview: RestorePreview }
        | { step: "writing" }
    >({ step: "pick" });
    const [choices, setChoices] = useState<Record<string, CollisionChoice>>({});
    const [error, setError] = useState<string | null>(null);

    const read = async (file: File | undefined) => {
        if (!file) return;
        setError(null);
        if (file.size > MAX_BACKUP_BYTES) {
            setState({ step: "problems", problems: [{ kind: "invalid", issues: [t("jobs.restore.tooLarge")] }] });
            return;
        }
        setState({ step: "reading" });
        const parsed = await parseTrackerBackup(await file.text());
        if (!parsed.ok) {
            setState({ step: "problems", problems: parsed.problems });
            return;
        }
        setChoices({});
        setState({ step: "preview", backup: parsed.backup, preview: await previewRestore(parsed.backup) });
    };

    const apply = async () => {
        if (state.step !== "preview") return;
        const { backup, preview } = state;
        setState({ step: "writing" });
        try {
            const result = await restoreTrackerBackup(backup, preview, choices);
            onAnnounce(t("jobs.restore.done", { added: result.added, replaced: result.replaced, skipped: result.skipped }));
            onClose();
        } catch (cause) {
            if (cause instanceof RestoreConflictError) {
                setState({ step: "preview", backup, preview: await previewRestore(backup) });
                setError(t("jobs.restore.changed"));
            } else {
                console.error("[EngineCV] Could not restore the backup.", cause);
                setState({ step: "preview", backup, preview });
                setError(t("jobs.restore.failed"));
            }
        }
    };

    const problemText = (problem: BackupProblem) => {
        if (problem.kind === "invalid") return problem.issues.slice(0, 5).join("; ");
        if (problem.kind === "duplicate-id") return t("jobs.restore.problem.duplicate", { id: problem.id });
        if (problem.kind === "packet") return t("jobs.restore.problem.packet", { id: problem.packetId });
        return t(`jobs.restore.problem.${problem.kind}`);
    };

    return (
        <div className="fixed inset-0 z-[220] flex items-end justify-center sm:items-center sm:p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={onClose} />
            <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="restore-title" className="glass-panel relative flex max-h-[100dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl" data-testid="restore-dialog">
                <div className="flex items-start justify-between gap-3 px-5 pt-5">
                    <div>
                        <h2 id="restore-title" className="text-lg font-bold text-strong">{t("jobs.backup.restore")}</h2>
                        <p className="mt-1 text-sm text-mid">{t("jobs.restore.hint")}</p>
                    </div>
                    <button type="button" onClick={onClose} aria-label={t("dashboard.cancel")} className="rounded-lg p-2 text-faint hover:text-strong"><X className="h-4 w-4" aria-hidden="true" /></button>
                </div>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                    {(state.step === "pick" || state.step === "problems") && (
                        <div>
                            <label htmlFor="restore-file" className="mb-1 block text-xs font-semibold text-mid">{t("jobs.restore.file")}</label>
                            <input id="restore-file" type="file" accept="application/json,.json" onChange={(event) => void read(event.target.files?.[0])} className={`${FIELD_CLASS} py-2`} data-autofocus data-testid="restore-file" />
                        </div>
                    )}
                    {(state.step === "reading" || state.step === "writing") && <p className="flex items-center gap-2 text-sm text-mid"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t(state.step === "reading" ? "jobs.restore.reading" : "jobs.restore.writing")}</p>}
                    {state.step === "problems" && (
                        <div role="alert" className="rounded-xl border border-danger/40 bg-danger-tint p-3 text-sm text-strong" data-testid="restore-problems">
                            <p className="font-medium">{t("jobs.restore.rejected")}</p>
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">{state.problems.slice(0, 8).map((problem, index) => <li key={index} className="break-words">{problemText(problem)}</li>)}</ul>
                        </div>
                    )}
                    {state.step === "preview" && (
                        <div className="space-y-3 text-sm" data-testid="restore-preview">
                            <ul className="space-y-1 text-mid">
                                <li>{t("jobs.restore.added", { count: state.preview.added.length })}</li>
                                <li>{t("jobs.restore.identical", { count: state.preview.identical.length })}</li>
                                <li>{t("jobs.restore.collisions", { count: state.preview.collisions.length })}</li>
                                {state.preview.blockedPackets.length > 0 && <li className="text-warning">{t("jobs.restore.blockedPackets", { count: state.preview.blockedPackets.length })}</li>}
                            </ul>
                            {state.preview.collisions.length > 0 && (
                                <fieldset className="space-y-2">
                                    <legend className="text-xs font-semibold text-mid">{t("jobs.restore.choose")}</legend>
                                    {state.preview.collisions.map(({ local, incoming }) => (
                                        <div key={incoming.id} className="flex flex-col gap-2 rounded-xl border border-edge bg-surface-3 p-3 sm:flex-row sm:items-center" data-testid="restore-collision">
                                            <span className="min-w-0 flex-1 break-words text-strong">{applicationTitle(local)}</span>
                                            <select aria-label={t("jobs.restore.chooseFor", { job: applicationTitle(local) })} value={choices[incoming.id] ?? "skip"} onChange={(event) => setChoices({ ...choices, [incoming.id]: event.target.value as CollisionChoice })} className={`${FIELD_CLASS} sm:w-56`} data-testid="restore-choice">
                                                {(["skip", "keep-local", "replace"] as const).map((choice) => <option key={choice} value={choice}>{t(`jobs.restore.choice.${choice}`)}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </fieldset>
                            )}
                            {error && <p role="alert" className="text-sm text-danger" data-testid="restore-error">{error}</p>}
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2 border-t border-edge px-5 py-4">
                    <button type="button" onClick={onClose} className={BUTTON_CLASS}>{t("dashboard.cancel")}</button>
                    {state.step === "preview" && <button type="button" onClick={() => void apply()} className={PRIMARY_BUTTON_CLASS} data-testid="restore-apply">{t("jobs.restore.apply")}</button>}
                </div>
            </div>
        </div>
    );
}
