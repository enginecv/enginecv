"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, KeyRound, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { PasswordField } from "./PasswordField";

interface SecretKeyDialogProps {
    open: boolean;
    title: string;
    description: string;
    value: string;
    onValueChange: (value: string) => void;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel: string;
    warning?: string;
    error?: string | null;
    inputLabel?: string;
    placeholder?: string;
    confirmDisabled?: boolean;
}

export function SecretKeyDialog({
    open,
    title,
    description,
    value,
    onValueChange,
    onConfirm,
    onCancel,
    confirmLabel,
    warning,
    error,
    inputLabel,
    placeholder,
    confirmDisabled = false,
}: SecretKeyDialogProps) {
    const { t } = useTranslation();
    const resolvedInputLabel = inputLabel ?? t("secretKey.inputLabel");
    const resolvedPlaceholder = placeholder ?? t("secretKey.placeholder");

    useEffect(() => {
        if (!open) {
            return;
        }

        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onCancel();
            }
        };

        const { overflow } = document.body.style;
        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", handleEsc);

        return () => {
            document.body.style.overflow = overflow;
            document.removeEventListener("keydown", handleEsc);
        };
    }, [open, onCancel]);

    if (!open || typeof document === "undefined") {
        return null;
    }

    return createPortal(
        <div className="fixed inset-0 z-[220] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative bg-surface-4 border border-edge rounded-[1rem] p-8 max-w-md w-full mx-4 shadow-2xl">
                <button onClick={onCancel} className="absolute top-4 right-4 text-faint hover:text-strong transition-colors">
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-xl bg-accent/10 text-accent">
                        <KeyRound className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-semibold text-strong">{title}</h2>
                </div>

                <p className="text-faint text-sm leading-relaxed">{description}</p>

                {warning && (
                    <div className="mt-5 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
                            <p className="text-xs text-bright leading-relaxed">{warning}</p>
                        </div>
                    </div>
                )}

                <div className="mt-5">
                    <PasswordField
                        label={resolvedInputLabel}
                        value={value}
                        onChange={onValueChange}
                        autoComplete="current-password"
                        spellCheck={false}
                        autoFocus
                        placeholder={resolvedPlaceholder}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && !confirmDisabled) {
                                event.preventDefault();
                                onConfirm();
                            }
                        }}
                    />
                </div>

                {error && (
                    <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-danger-soft">
                        {error}
                    </div>
                )}

                <div className="mt-6 flex gap-3 justify-end">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-5 py-2.5 rounded-xl text-sm font-medium text-faint hover:text-strong hover:bg-edge transition-colors"
                    >
                        {t("dashboard.cancel")}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={confirmDisabled}
                        className="px-5 py-2.5 rounded-xl text-sm font-medium bg-accent hover:bg-accent-soft text-surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
