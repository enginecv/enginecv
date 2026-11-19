"use client";

import { Loader2 } from "lucide-react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";

/** After a CV is duplicated: its letters stay with the original, and the person may copy them onto the new CV too. */
export function CopyLettersDialog({ count, busy, error, onCopy, onSkip }: {
    count: number;
    busy: boolean;
    error: boolean;
    onCopy: () => void;
    onSkip: () => void;
}) {
    const { t } = useTranslation();
    const ref = useDialogFocus<HTMLDivElement>(true, onSkip);
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={onSkip} />
            <div ref={ref} role="dialog" aria-modal="true" aria-label={t("letters.copyLetters.title")} className="glass-panel relative w-full max-w-md rounded-2xl p-6 shadow-2xl" data-testid="copy-letters-dialog">
                <h2 className="text-lg font-bold text-strong">{t("letters.copyLetters.title")}</h2>
                <p className="mt-2 text-sm text-mid">{t("letters.copyLetters.body", { count })}</p>
                {error && <p role="alert" className="mt-3 text-sm text-danger">{t("letters.action.error")}</p>}
                <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={onSkip} data-testid="copy-letters-skip" className="rounded-xl border border-edge bg-surface-4 px-4 py-2 text-sm font-bold text-mid hover:border-faint hover:text-strong">{t("letters.copyLetters.skip")}</button>
                    <button type="button" disabled={busy} onClick={onCopy} data-testid="copy-letters-copy" className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-surface-2 hover:bg-accent-soft disabled:opacity-60">
                        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {t("letters.copyLetters.copy", { count })}
                    </button>
                </div>
            </div>
        </div>
    );
}
