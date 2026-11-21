"use client";

import { useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";
import type { RetireChoice } from "@/lib/workspace/lifecycle";

/** Deleting a document that has a file in the workspace folder: the file is kept unless the person says otherwise. */
export function DeleteDocumentDialog({ name, description, confirmLabel, busy, onConfirm, onCancel }: { name: string; description: string; confirmLabel: string; busy?: boolean; onConfirm: (choice: RetireChoice) => void; onCancel: () => void }) {
    const { t } = useTranslation();
    const ref = useDialogFocus<HTMLDivElement>(true, onCancel);
    const [choice, setChoice] = useState<RetireChoice>("keep-file");
    const option = "flex cursor-pointer items-start gap-2 rounded-xl border border-edge bg-surface-1 p-3 text-sm";
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={onCancel} />
            <div ref={ref} role="dialog" aria-modal="true" aria-label={t("workspace.delete.title")} data-testid="workspace-delete" className="glass-panel relative w-full max-w-md rounded-2xl p-6 shadow-2xl">
                <h3 className="text-lg font-bold text-strong">{t("workspace.delete.title")}</h3>
                <p className="mt-2 text-sm text-mid">{description}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-faint">{name}</p>
                <fieldset className="mt-2 space-y-2">
                    <legend className="sr-only">{t("workspace.delete.fileQuestion")}</legend>
                    <label className={option}>
                        <input type="radio" name="workspace-delete-choice" checked={choice === "keep-file"} onChange={() => setChoice("keep-file")} data-testid="workspace-delete-keep" className="mt-0.5" />
                        <span><span className="font-medium text-strong">{t("workspace.delete.keepFile")}</span><span className="block text-xs text-faint">{t("workspace.delete.keepFileHint")}</span></span>
                    </label>
                    <label className={option}>
                        <input type="radio" name="workspace-delete-choice" checked={choice === "delete-file"} onChange={() => setChoice("delete-file")} data-testid="workspace-delete-remove" className="mt-0.5" />
                        <span><span className="font-medium text-strong">{t("workspace.delete.deleteFile")}</span><span className="block text-xs text-faint">{t("workspace.delete.deleteFileHint")}</span></span>
                    </label>
                </fieldset>
                <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={onCancel} disabled={busy} data-testid="workspace-delete-cancel" className="rounded-xl border border-edge bg-surface-4 px-4 py-2 text-sm font-bold text-mid hover:border-faint hover:text-strong">{t("dashboard.cancel")}</button>
                    <button type="button" onClick={() => onConfirm(choice)} disabled={busy} data-testid="workspace-delete-confirm" className="rounded-xl bg-danger px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60">{confirmLabel}</button>
                </div>
            </div>
        </div>
    );
}
