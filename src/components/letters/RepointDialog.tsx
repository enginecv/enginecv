"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";
import type { LetterDocument, SenderKey } from "@/lib/letters/schema";
import { CvChoiceGrid, type CvChoice } from "./CvChoiceGrid";

export type { CvChoice };

/**
 * Picks a CV for a letter: to move a draft to it ("repoint"), or to copy the letter
 * onto it ("duplicate"). It names the sender fields the person overrode, because they
 * stay overridden after the move or copy and should not surprise anyone.
 */
export function RepointDialog({ letter, cvs, mode, busy, onConfirm, onClose }: {
    letter: LetterDocument;
    cvs: CvChoice[];
    mode: "repoint" | "duplicate";
    busy: boolean;
    onConfirm: (cvId: string) => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const ref = useDialogFocus<HTMLDivElement>(true, onClose);
    // A move needs a different CV; a copy may go to the same one or another.
    const choices = mode === "repoint" ? cvs.filter((cv) => cv.id !== letter.cvId) : cvs;
    const [cvId, setCvId] = useState(choices[0]?.id ?? "");
    const kept = (Object.keys(letter.senderOverrides) as SenderKey[]).filter((key) => letter.senderOverrides[key] !== undefined);
    const title = t(mode === "repoint" ? "dashboard.letters.repoint.title" : "dashboard.letters.duplicateInto.title");

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={onClose} />
            <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="glass-panel relative w-full max-w-2xl rounded-2xl p-6 shadow-2xl" data-testid="letter-repoint-dialog">
                <h2 className="text-lg font-bold text-strong">{title}</h2>
                <p className="mt-2 text-sm text-mid">{t(mode === "repoint" ? "dashboard.letters.repoint.hint" : "dashboard.letters.duplicateInto.hint")}</p>
                {choices.length === 0 ? (
                    <p className="mt-4 text-sm text-mid" data-testid="letter-repoint-none">{t("dashboard.letters.repoint.noOther")}</p>
                ) : (
                    <CvChoiceGrid choices={choices} value={cvId} onChange={setCvId} name="repoint-cv" testIdPrefix="letter-repoint" />
                )}
                {kept.length > 0 && (
                    <p className="mt-3 text-xs text-mid" data-testid="letter-repoint-kept">
                        {t("dashboard.letters.repoint.keeps", { fields: kept.map((key) => t(`letters.field.${key}`)).join(", ") })}
                    </p>
                )}
                <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="rounded-xl border border-edge bg-surface-4 px-4 py-2 text-sm font-bold text-mid hover:border-faint hover:text-strong">{t("dashboard.cancel")}</button>
                    <button type="button" disabled={busy || !cvId} onClick={() => onConfirm(cvId)} data-testid="letter-repoint-confirm" className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-surface-2 hover:bg-accent-soft disabled:opacity-60">
                        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {t(mode === "repoint" ? "dashboard.letters.repoint.confirm" : "dashboard.letters.duplicateInto.confirm")}
                    </button>
                </div>
            </div>
        </div>
    );
}
