"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    DISABILITY_KEYS,
    getDisabilityLabel,
    parseDisability,
    serializeDisability,
    type DisabilityKey,
} from "@/lib/disability";

export interface DisabilityInputProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    language?: string;
    className?: string;
}

export function DisabilityInput({
    label,
    value,
    onChange,
    placeholder,
    language,
    className,
}: DisabilityInputProps) {
    const { t, locale } = useTranslation();
    placeholder ??= t("input.disabilityStatus");
    language ??= locale;
    const parsed = React.useMemo(() => parseDisability(value), [value]);
    const initialKey: DisabilityKey | undefined =
        parsed?.kind === "key" ? parsed.key : parsed?.kind === "other" ? "other" : undefined;
    const initialOtherText = parsed?.kind === "other" || parsed?.kind === "raw" ? parsed.text : "";

    const [selectedKey, setSelectedKey] = React.useState<DisabilityKey | undefined>(initialKey);
    const [otherText, setOtherText] = React.useState(initialOtherText);

    React.useEffect(() => {
        const next = parseDisability(value);
        if (!next) {
            setSelectedKey(undefined);
            setOtherText("");
            return;
        }
        if (next.kind === "key") {
            setSelectedKey(next.key);
            if (next.key !== "other") setOtherText("");
            return;
        }
        // other or raw
        setSelectedKey("other");
        setOtherText(next.text);
    }, [value]);

    const handleSelect = (key: string) => {
        const k = key as DisabilityKey;
        setSelectedKey(k);
        if (k === "other") {
            onChange(serializeDisability({ kind: "other", text: otherText }));
        } else {
            setOtherText("");
            onChange(serializeDisability({ kind: "key", key: k }));
        }
    };

    const handleOtherText = (text: string) => {
        setOtherText(text);
        onChange(serializeDisability({ kind: "other", text }));
    };

    return (
        <div className={cn("space-y-2", className)}>
            {label && (
                <label className="text-[11px] font-medium text-faint uppercase tracking-wider block">
                    {label}
                </label>
            )}
            <Select value={selectedKey ?? undefined} onValueChange={handleSelect}>
                <SelectTrigger className="w-full rounded-xl px-4 py-2.5 h-auto bg-surface-1 border-edge hover:border-faint text-sm">
                    <SelectValue placeholder={placeholder}>
                        {selectedKey ? getDisabilityLabel(selectedKey, language) : placeholder}
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {DISABILITY_KEYS.map((key) => (
                        <SelectItem key={key} value={key}>
                            {getDisabilityLabel(key as DisabilityKey, language)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            {selectedKey === "other" && (
                <Input
                    value={otherText}
                    onChange={(e) => handleOtherText(e.target.value)}
                    placeholder={t("input.describeOptional")}
                    aria-label={t("input.describeDisability")}
                />
            )}
        </div>
    );
}
