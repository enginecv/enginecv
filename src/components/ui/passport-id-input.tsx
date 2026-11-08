"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { CountryDropdown } from "@/components/ui/country-dropdown";
import { Input } from "@/components/ui/input";

export type DocumentEntry = { country: string; number: string };

export function parseDocument(value: string): DocumentEntry {
    if (!value) return { country: "", number: "" };
    const colon = value.indexOf(":");
    if (colon === -1) return { country: "", number: value.trim() };
    return {
        country: value.slice(0, colon).trim(),
        number: value.slice(colon + 1).trim(),
    };
}

export function serializeDocument(entry: DocumentEntry): string {
    if (!entry.country && !entry.number) return "";
    if (!entry.country) return entry.number;
    if (!entry.number) return `${entry.country}:`;
    return `${entry.country}: ${entry.number}`;
}

export function parseDocuments(value: string): DocumentEntry[] {
    if (!value.trim()) return [];
    return value
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .map(parseDocument);
}

export function serializeDocuments(entries: DocumentEntry[]): string {
    return entries
        .filter((e) => e.country || e.number)
        .map(serializeDocument)
        .join("; ");
}

// Backward-compat aliases for prior usage sites.
export const parsePassportId = parseDocument;
export const serializePassportId = (country: string, number: string) =>
    serializeDocument({ country, number });

export interface MultiDocumentInputProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    addLabel?: string;
    className?: string;
}

export function MultiDocumentInput({
    label,
    value,
    onChange,
    placeholder,
    addLabel,
    className,
}: MultiDocumentInputProps) {
    const { t } = useTranslation();
    placeholder ??= t("input.documentNumber");
    addLabel ??= t("input.addDocument");
    const [entries, setEntries] = React.useState<DocumentEntry[]>(() => parseDocuments(value));

    React.useEffect(() => {
        const parsed = parseDocuments(value);
        if (serializeDocuments(parsed) !== serializeDocuments(entries)) {
            setEntries(parsed);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const commit = (next: DocumentEntry[]) => {
        setEntries(next);
        onChange(serializeDocuments(next));
    };

    const addEntry = () => commit([...entries, { country: "", number: "" }]);
    const updateEntry = (i: number, patch: Partial<DocumentEntry>) =>
        commit(entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
    const removeEntry = (i: number) => commit(entries.filter((_, idx) => idx !== i));

    return (
        <div className={cn("space-y-2", className)}>
            {label && (
                <label className="text-[11px] font-medium text-faint uppercase tracking-wider block">
                    {label}
                </label>
            )}
            <div className="space-y-2">
                {entries.map((entry, index) => (
                    <div
                        key={index}
                        className="rounded-xl border border-edge bg-surface-1 p-2 space-y-2"
                    >
                        <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                                <CountryDropdown
                                    value={entry.country}
                                    onChange={(c) => updateEntry(index, { country: c })}
                                    placeholder={t("input.issuingCountry")}
                                    multiple={false}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => removeEntry(index)}
                                aria-label={t("input.removeDocument")}
                                className="text-faint hover:text-danger transition-colors p-1.5 rounded-md hover:bg-surface-4 shrink-0"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <Input
                            value={entry.number}
                            onChange={(e) => updateEntry(index, { number: e.target.value })}
                            placeholder={placeholder}
                            aria-label={t("input.documentNumber")}
                        />
                    </div>
                ))}
            </div>
            <button
                type="button"
                onClick={addEntry}
                className="inline-flex items-center gap-1.5 text-xs text-dim hover:text-strong transition-colors px-2 py-1 rounded-md hover:bg-surface-4"
            >
                <Plus className="w-3.5 h-3.5" />
                {addLabel}
            </button>
        </div>
    );
}

// Backward-compat single-entry component kept for legacy passportOrId field.
export interface PassportIdInputProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export function PassportIdInput({
    label,
    value,
    onChange,
    placeholder,
    className,
}: PassportIdInputProps) {
    const { t } = useTranslation();
    placeholder ??= t("input.documentNumber");
    const parsed = React.useMemo(() => parseDocument(value), [value]);
    const [country, setCountry] = React.useState(parsed.country);
    const [number, setNumber] = React.useState(parsed.number);

    React.useEffect(() => {
        const next = parseDocument(value);
        if (next.country !== country) setCountry(next.country);
        if (next.number !== number) setNumber(next.number);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const commit = (nextCountry: string, nextNumber: string) => {
        setCountry(nextCountry);
        setNumber(nextNumber);
        onChange(serializeDocument({ country: nextCountry, number: nextNumber }));
    };

    return (
        <div className={cn("space-y-2", className)}>
            {label && (
                <label className="text-[11px] font-medium text-faint uppercase tracking-wider block">
                    {label}
                </label>
            )}
            <div className="space-y-2">
                <CountryDropdown
                    value={country}
                    onChange={(c) => commit(c, number)}
                    placeholder={t("input.issuingCountry")}
                    multiple={false}
                />
                <Input
                    value={number}
                    onChange={(e) => commit(country, e.target.value)}
                    placeholder={placeholder}
                    aria-label={t("input.documentNumber")}
                />
            </div>
        </div>
    );
}
