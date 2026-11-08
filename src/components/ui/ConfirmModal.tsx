"use client";

import { AlertTriangle, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useDialogFocus } from "@/hooks/useDialogFocus";

export function ConfirmModal({
    open,
    title,
    description,
    confirmLabel,
    onConfirm,
    onCancel,
    destructive,
    secondaryAction,
}: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
    destructive?: boolean;
    secondaryAction?: { label: string; onClick: () => void };
}) {
    const { t } = useTranslation();
    const dialogRef = useDialogFocus<HTMLDivElement>(open, onCancel);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md animate-in fade-in duration-300" onClick={onCancel} />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                className="relative glass-panel rounded-2xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300"
            >
                <button type="button" onClick={onCancel} aria-label={t("common.close")} className="absolute top-4 right-4 text-faint hover:text-strong transition-all duration-200 hover:rotate-90">
                    <X className="w-5 h-5" aria-hidden="true" />
                </button>

                <div className="flex flex-col items-center text-center mb-8">
                    {destructive ? (
                        <div className="h-16 w-16 rounded-2xl bg-red-500/10 text-danger border border-red-500/20 flex items-center justify-center mb-6 shadow-lg shadow-red-500/5">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                    ) : (
                        <div className="h-16 w-16 rounded-2xl bg-accent/10 text-accent border border-accent/20 flex items-center justify-center mb-6 shadow-lg shadow-accent/5">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                    )}
                    <h2 className="text-xl font-bold text-strong tracking-tight leading-tight">{title}</h2>
                    <p className="mt-3 text-mid text-sm leading-relaxed">{description}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {secondaryAction && <button type="button" onClick={secondaryAction.onClick} className="col-span-2 rounded-xl border border-edge px-5 py-3 text-sm font-bold text-accent">{secondaryAction.label}</button>}
                    <button
                        onClick={onCancel}
                        className="px-5 py-3 rounded-xl text-sm font-bold text-mid border border-edge bg-surface-4 hover:text-strong hover:border-faint transition-all active:scale-[0.98]"
                    >
                        {t("dashboard.cancel")}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-5 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98] shadow-lg ${
                            destructive
                                ? "bg-red-500 hover:bg-red-600 text-white shadow-red-500/20"
                                : "bg-accent hover:bg-accent-soft text-surface-2 shadow-accent/20"
                        }`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
