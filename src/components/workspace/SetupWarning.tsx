"use client";

import { ShieldAlert } from "lucide-react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";

/**
 * Shown before the first file is written: the files hold personal details, and where the folder
 * syncs decides who can see them. The person can leave contact details out of the files.
 */
export function SetupWarning({ hideContact, onHideChange, onContinue, onCancel }: {
    hideContact: boolean;
    onHideChange: (hide: boolean) => void;
    onContinue: () => void;
    onCancel: () => void;
}) {
    const { t } = useTranslation();
    const ref = useDialogFocus<HTMLDivElement>(true, onCancel);
    return (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={onCancel} />
            <div ref={ref} role="dialog" aria-modal="true" aria-label={t("workspace.warning.title")} data-testid="workspace-warning" className="glass-panel relative w-full max-w-md rounded-2xl p-6 shadow-2xl">
                <div className="flex items-start gap-3">
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                    <div className="min-w-0">
                        <h2 className="text-lg font-bold text-strong">{t("workspace.warning.title")}</h2>
                        <p className="mt-2 text-sm text-mid">{t("workspace.warning.body")}</p>
                    </div>
                </div>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-edge bg-surface-1 p-3">
                    <input type="checkbox" checked={hideContact} onChange={(event) => onHideChange(event.target.checked)} data-testid="workspace-warning-hide" className="mt-1" />
                    <span className="min-w-0">
                        <span className="block text-sm font-medium text-strong">{t("workspace.warning.hide")}</span>
                        <span className="block text-xs text-mid">{t("workspace.warning.hideHint")}</span>
                    </span>
                </label>
                <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={onCancel} data-testid="workspace-warning-cancel" className="rounded-xl border border-edge bg-surface-4 px-4 py-2 text-sm font-bold text-mid hover:border-faint hover:text-strong">{t("dashboard.cancel")}</button>
                    <button type="button" onClick={onContinue} data-testid="workspace-warning-continue" className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-surface-2 hover:bg-accent-soft">{t("workspace.warning.continue")}</button>
                </div>
            </div>
        </div>
    );
}
