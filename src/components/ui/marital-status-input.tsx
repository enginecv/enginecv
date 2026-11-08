"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    MARITAL_STATUS_KEYS,
    getMaritalStatusLabel,
    normalizeMaritalStatus,
    isMaritalStatusKey,
    type MaritalStatusKey,
} from "@/lib/marital-status";

export interface MaritalStatusInputProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    language?: string;
    className?: string;
}

export function MaritalStatusInput({
    label,
    value,
    onChange,
    placeholder,
    language,
    className,
}: MaritalStatusInputProps) {
    const { t, locale } = useTranslation();
    placeholder ??= t("input.maritalStatus");
    language ??= locale;
    const normalized = React.useMemo(() => normalizeMaritalStatus(value), [value]);

    React.useEffect(() => {
        if (value && value !== normalized && isMaritalStatusKey(normalized)) {
            onChange(normalized);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [normalized]);

    const handleChange = (next: string) => {
        onChange(next);
    };

    const selectedLabel = isMaritalStatusKey(normalized)
        ? getMaritalStatusLabel(normalized, language)
        : normalized;

    return (
        <div className={cn("space-y-2", className)}>
            {label && (
                <label className="text-[11px] font-medium text-faint uppercase tracking-wider block">
                    {label}
                </label>
            )}
            <Select value={isMaritalStatusKey(normalized) ? normalized : undefined} onValueChange={handleChange}>
                <SelectTrigger className="w-full rounded-xl px-4 py-2.5 h-auto bg-surface-1 border-edge hover:border-faint text-sm">
                    <SelectValue placeholder={placeholder}>
                        {selectedLabel || placeholder}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {MARITAL_STATUS_KEYS.map((key) => (
                        <SelectItem key={key} value={key}>
                            {getMaritalStatusLabel(key as MaritalStatusKey, language)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
