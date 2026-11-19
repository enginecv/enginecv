"use client";

import { useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";
import type { PendingReview } from "@/lib/workspace/types";

/**
 * A complete file that would remove a lot. Nothing has changed yet: apply it (a restore point is saved
 * first) or keep EngineCV's version (confirmed, because it overwrites the file).
 */
export function ReviewDialog({ docTitle, review, onApply, onKeepMine, onClose }: { docTitle: string; review: PendingReview; onApply: () => void; onKeepMine: () => void; onClose: () => void }) {
    const { t } = useTranslation();
    const ref = useDialogFocus<HTMLDivElement>(true, onClose);
    const [confirmKeep, setConfirmKeep] = useState(false);
    const more = review.previousCount - review.keptCount - review.removed.length;
    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={onClose} />
            <div ref={ref} role="dialog" aria-modal="true" aria-label={t("workspace.review.title")} data-testid="workspace-review" className="glass-panel relative w-full max-w-md rounded-2xl p-6 shadow-2xl">
                <h3 className="text-lg font-bold text-strong">{t("workspace.review.title")}</h3>
                <p className="mt-1 text-xs text-faint">{docTitle}</p>
                <p className="mt-3 text-sm text-mid">{t("workspace.review.body", { kept: review.keptCount, previous: review.previousCount })}</p>
                <ul className="mt-2 max-h-48 list-disc space-y-0.5 overflow-auto pl-5 text-sm text-strong" data-testid="workspace-review-removed">
                    {review.removed.map((title, index) => <li key={index}>{title}</li>)}
                    {more > 0 && <li className="list-none text-faint">{t("workspace.review.andMore")} (+{more})</li>}
                </ul>
                <p className="mt-3 text-xs text-faint">{t("workspace.review.applyNote")}</p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => setConfirmKeep(true)} data-testid="workspace-review-keep" className="rounded-xl border border-edge bg-surface-4 px-4 py-2 text-sm font-bold text-strong hover:border-faint">{t("workspace.review.keepMine")}</button>
                    <button type="button" onClick={onApply} data-testid="workspace-review-apply" className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-surface-2 hover:bg-accent-soft">{t("workspace.review.apply")}</button>
                </div>
            </div>
            <ConfirmModal open={confirmKeep} title={t("workspace.review.keepConfirmTitle")} description={t("workspace.review.keepConfirmBody")} confirmLabel={t("workspace.review.keepMine")} destructive onConfirm={() => { setConfirmKeep(false); onKeepMine(); }} onCancel={() => setConfirmKeep(false)} />
        </div>
    );
}
