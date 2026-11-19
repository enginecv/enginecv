"use client";

import { Loader2 } from "lucide-react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";
import type { LetterWarning } from "@/lib/letters/resolve";
import { warningText } from "./warnings";

/** Asks before a letter is frozen as sent, and shows what looks wrong with it first. */
export function MarkSentDialog({ warnings, busy, onConfirm, onClose }: {
    warnings: LetterWarning[];
    busy: boolean;
    onConfirm: () => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const ref = useDialogFocus<HTMLDivElement>(true, onClose);
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={onClose} />
            <div ref={ref} role="dialog" aria-modal="true" aria-label={t("letters.send.title")} className="glass-panel relative w-full max-w-md rounded-2xl p-6 shadow-2xl" data-testid="letter-send-dialog">
                <h2 className="text-lg font-bold text-strong">{t("letters.send.title")}</h2>
                <p className="mt-2 text-sm text-mid">{t("letters.send.body")}</p>
                {warnings.length > 0 && (
                    <div className="mt-4 rounded-xl border border-accent/30 bg-surface-1 p-3" data-testid="letter-send-warnings">
                        <p className="text-xs font-semibold text-strong">{t("letters.send.warningsIntro")}</p>
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-mid">
                            {warnings.map((warning, index) => <li key={index}>{warningText(t, warning)}</li>)}
                        </ul>
                    </div>
                )}
                <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="rounded-xl border border-edge bg-surface-4 px-4 py-2 text-sm font-bold text-mid hover:border-faint hover:text-strong">{t("dashboard.cancel")}</button>
                    <button type="button" disabled={busy} onClick={onConfirm} data-testid="letter-send-confirm" className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-surface-2 hover:bg-accent-soft disabled:opacity-60">
                        {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {t(warnings.length > 0 ? "letters.send.confirmAnyway" : "letters.send.confirm")}
                    </button>
                </div>
            </div>
        </div>
    );
}
