"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { letterDisplayTitle } from "@/components/dashboard/LetterCard";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";
import type { DeletionDecision } from "@/lib/letters/deletion";
import type { LetterDocument } from "@/lib/letters/schema";
import type { CvChoice } from "./RepointDialog";

const SNAPSHOT = "snapshot";
const linkValue = (cvId: string) => `link:${cvId}`;

function toDecision(letterId: string, value: string): DeletionDecision | null {
    if (value === SNAPSHOT) return { letterId, action: "snapshot" };
    if (value.startsWith("link:")) return { letterId, action: "link", cvId: value.slice("link:".length) };
    return null;
}

/**
 * Shown when a CV that has letters is deleted. Nothing is deleted with it: frozen letters
 * keep their content, and each draft is either moved to another CV or frozen as it last
 * looked. The delete button stays off until every draft has an answer.
 */
export function DeleteCvDialog({ cvName, letters, otherCvs, busy, error, onConfirm, onCancel }: {
    cvName: string;
    letters: LetterDocument[];
    otherCvs: CvChoice[];
    busy: boolean;
    error: boolean;
    onConfirm: (decisions: DeletionDecision[]) => void;
    onCancel: () => void;
}) {
    const { t } = useTranslation();
    const ref = useDialogFocus<HTMLDivElement>(true, onCancel);
    const drafts = letters.filter((letter) => letter.status === "draft");
    const frozenCount = letters.length - drafts.length;
    const [choices, setChoices] = useState<Record<string, string>>({});

    const decisions = drafts.map((draft) => toDecision(draft.id, choices[draft.id] ?? ""));
    const ready = decisions.every((decision) => decision !== null);

    const options = (
        <>
            <option value="">{t("letters.deleteCv.choose")}</option>
            {otherCvs.map((cv) => <option key={cv.id} value={linkValue(cv.id)}>{t("letters.deleteCv.follow", { cv: cv.label })}</option>)}
            <option value={SNAPSHOT}>{t("letters.deleteCv.snapshot")}</option>
        </>
    );
    const selectClass = "w-full rounded-xl border border-edge bg-surface-1 px-3 py-2 text-sm text-strong";

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={onCancel} />
            <div ref={ref} role="dialog" aria-modal="true" aria-label={t("dashboard.deleteTitle")} className="glass-panel relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-2xl" data-testid="delete-cv-dialog">
                <h2 className="text-lg font-bold text-strong">{t("dashboard.deleteTitle")}</h2>
                <p className="mt-2 text-sm text-mid" data-testid="delete-cv-summary">{t("letters.deleteCv.summary", { name: cvName, count: letters.length })}</p>

                {frozenCount > 0 && (
                    <p className="mt-3 rounded-xl border border-edge bg-surface-1 p-3 text-xs text-mid" data-testid="delete-cv-frozen">{t("letters.deleteCv.frozen", { count: frozenCount })}</p>
                )}

                {drafts.length > 0 && (
                    <div className="mt-4 space-y-3">
                        <p className="text-sm font-medium text-strong">{t("letters.deleteCv.draftsIntro", { count: drafts.length })}</p>
                        {drafts.length > 1 && (
                            <label className="block space-y-1 text-xs text-faint">
                                <span className="font-medium uppercase tracking-wider">{t("letters.deleteCv.sameForAll")}</span>
                                <select value="" onChange={(event) => event.target.value && setChoices(Object.fromEntries(drafts.map((draft) => [draft.id, event.target.value])))} data-testid="delete-choice-all" className={selectClass}>
                                    {options}
                                </select>
                            </label>
                        )}
                        <ul className="space-y-3">
                            {drafts.map((draft) => (
                                <li key={draft.id} className="space-y-1" data-testid="delete-cv-draft">
                                    <p className="truncate text-sm text-strong">{letterDisplayTitle(draft, t("letters.editor.untitled"))}</p>
                                    <select value={choices[draft.id] ?? ""} onChange={(event) => setChoices((current) => ({ ...current, [draft.id]: event.target.value }))} aria-label={letterDisplayTitle(draft, t("letters.editor.untitled"))} data-testid={`delete-choice-${draft.id}`} className={selectClass}>
                                        {options}
                                    </select>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {error && <p role="alert" className="mt-3 text-sm text-danger" data-testid="delete-cv-error">{t("letters.deleteCv.error")}</p>}

                <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={onCancel} data-testid="delete-cv-cancel" className="rounded-xl border border-edge bg-surface-4 px-4 py-2 text-sm font-bold text-mid hover:border-faint hover:text-strong">{t("dashboard.cancel")}</button>
                    <button type="button" disabled={!ready || busy} onClick={() => onConfirm(decisions.filter((decision): decision is DeletionDecision => decision !== null))} data-testid="delete-cv-confirm" className="flex items-center gap-2 rounded-xl bg-danger px-4 py-2 text-sm font-bold text-surface-2 hover:opacity-90 disabled:opacity-50">
                        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {t("dashboard.deletePermanently")}
                    </button>
                </div>
            </div>
        </div>
    );
}
