"use client";

import { AlertTriangle, ChevronDown, Loader2, X } from "lucide-react";
import { useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";
import { detailsFromForm, emptyDetailsForm, type DetailsErrors, type DetailsField, type DetailsForm } from "@/lib/jobs/form";
import { changeStage, defaultContext, newApplication } from "@/lib/jobs/operations";
import { insertApplication } from "@/lib/jobs/repository";
import type { ApplicationStage, JobApplication } from "@/lib/jobs/schema";
import { findPossibleDuplicate, type DuplicateMatch } from "@/lib/jobs/selectors";
import { EssentialFields, MoreFields } from "./DetailsFields";
import { BUTTON_CLASS, PRIMARY_BUTTON_CLASS, applicationTitle } from "./shared";

/**
 * "Add job": company and role, an optional link (kept as typed, never fetched), and more details on
 * request. A possible duplicate is a warning with a way to open the existing record, never a block.
 */
export function AddJobDialog({ applications, initialStage, onClose, onCreated, onOpenExisting }: {
    applications: readonly JobApplication[];
    /** The board column it was opened from; a new job otherwise starts as Saved. */
    initialStage: ApplicationStage;
    onClose: () => void;
    onCreated: (application: JobApplication) => void;
    onOpenExisting: (id: string) => void;
}) {
    const { t } = useTranslation();
    const ref = useDialogFocus<HTMLDivElement>(true, onClose);
    const [form, setForm] = useState<DetailsForm>(emptyDetailsForm);
    const [errors, setErrors] = useState<DetailsErrors>({});
    const [more, setMore] = useState(false);
    const [duplicate, setDuplicate] = useState<DuplicateMatch | null>(null);
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);

    const change = <K extends DetailsField>(field: K, value: DetailsForm[K]) => {
        setForm((current) => ({ ...current, [field]: value }));
        setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));
        if (field === "company" || field === "role" || field === "jobUrl") setDuplicate(null);
    };

    const save = async (allowDuplicate: boolean) => {
        const result = detailsFromForm(form);
        if (!result.ok) {
            setErrors(result.errors);
            // Errors in the hidden part are shown, not left invisible.
            if (Object.keys(result.errors).some((field) => !["company", "role", "jobUrl"].includes(field))) setMore(true);
            return;
        }
        if (!allowDuplicate) {
            const match = findPossibleDuplicate(applications, result.details);
            if (match) {
                setDuplicate(match);
                return;
            }
        }
        setBusy(true);
        setFailed(false);
        try {
            const ctx = defaultContext();
            const created = newApplication(result.details, ctx);
            const staged = initialStage === "saved" ? created : changeStage(created, initialStage, ctx);
            onCreated(await insertApplication(staged));
        } catch (error) {
            console.error("[EngineCV] Could not save the new job.", error);
            setFailed(true);
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={onClose} />
            <div
                ref={ref}
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-job-title"
                className="glass-panel relative flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl"
                data-testid="add-job-dialog"
            >
                <form
                    className="flex min-h-0 flex-1 flex-col"
                    noValidate
                    onSubmit={(event) => {
                        event.preventDefault();
                        void save(false);
                    }}
                >
                    <div className="flex items-start justify-between gap-3 px-5 pt-5">
                        <div>
                            <h2 id="add-job-title" className="text-lg font-bold text-strong">{t("jobs.add.title")}</h2>
                            <p className="mt-1 text-sm text-mid">{t("jobs.add.hint")}</p>
                        </div>
                        <button type="button" onClick={onClose} aria-label={t("dashboard.cancel")} className="rounded-lg p-2 text-faint hover:text-strong">
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                        <EssentialFields form={form} errors={errors} onChange={change} idPrefix="add-job" focusFirst />
                        <button
                            type="button"
                            aria-expanded={more}
                            aria-controls="add-job-more"
                            onClick={() => setMore((value) => !value)}
                            data-testid="add-job-more"
                            className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                        >
                            <ChevronDown className={`h-4 w-4 transition-transform ${more ? "rotate-180" : ""}`} aria-hidden="true" />
                            {t("jobs.add.more")}
                        </button>
                        <div id="add-job-more" hidden={!more}>
                            {more && <MoreFields form={form} errors={errors} onChange={change} idPrefix="add-job" />}
                        </div>
                        {duplicate && (
                            <div role="alert" className="rounded-xl border border-warning-tint2 bg-warning-tint p-3 text-sm text-strong" data-testid="add-job-duplicate">
                                <p className="flex items-start gap-2">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                                    <span>{t(duplicate.reason === "url" ? "jobs.add.duplicateUrl" : "jobs.add.duplicateRole", { job: applicationTitle(duplicate.application) })}</span>
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button type="button" className={BUTTON_CLASS} onClick={() => onOpenExisting(duplicate.application.id)} data-testid="add-job-open-existing">{t("jobs.add.openExisting")}</button>
                                    <button type="button" className={BUTTON_CLASS} onClick={() => void save(true)} disabled={busy} data-testid="add-job-save-anyway">{t("jobs.add.saveAnyway")}</button>
                                </div>
                            </div>
                        )}
                        {failed && <p role="alert" className="text-sm text-danger" data-testid="add-job-error">{t("jobs.error.save")}</p>}
                    </div>
                    <div className="flex justify-end gap-2 border-t border-edge px-5 py-4">
                        <button type="button" onClick={onClose} className={BUTTON_CLASS}>{t("dashboard.cancel")}</button>
                        <button type="submit" disabled={busy} className={PRIMARY_BUTTON_CLASS} data-testid="add-job-save">
                            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                            {t("jobs.add.save")}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
