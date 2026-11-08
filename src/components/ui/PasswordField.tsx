"use client";

import type { InputHTMLAttributes } from "react";
import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    className?: string;
    labelClassName?: string;
    inputClassName?: string;
    showLabel?: string;
    hideLabel?: string;
};

export function PasswordField({
    label,
    value,
    onChange,
    className = "",
    labelClassName = "",
    inputClassName = "",
    showLabel,
    hideLabel,
    id,
    ...inputProps
}: PasswordFieldProps) {
    const { t } = useTranslation();
    const generatedId = useId();
    const [isVisible, setIsVisible] = useState(false);
    const inputId = id ?? generatedId;
    const resolvedShowLabel = showLabel ?? t("passwordField.show");
    const resolvedHideLabel = hideLabel ?? t("passwordField.hide");

    return (
        <label htmlFor={inputId} className={`block ${className}`}>
            {label && (
                <span className={`block text-xs font-medium text-faint uppercase tracking-wider mb-2 ${labelClassName}`}>
                    {label}
                </span>
            )}

            <div className="relative">
                <input
                    {...inputProps}
                    id={inputId}
                    type={isVisible ? "text" : "password"}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className={`w-full bg-surface-4 border border-edge rounded-xl px-4 py-3 pr-12 text-sm text-strong focus:outline-none focus:border-faint transition-colors ${inputClassName}`}
                />
                <button
                    type="button"
                    onClick={() => setIsVisible((current) => !current)}
                    className="absolute inset-y-0 right-2 flex items-center justify-center px-2 text-faint hover:text-strong transition-colors"
                    aria-label={isVisible ? resolvedHideLabel : resolvedShowLabel}
                    title={isVisible ? resolvedHideLabel : resolvedShowLabel}
                    aria-pressed={isVisible}
                >
                    {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
            </div>
        </label>
    );
}
