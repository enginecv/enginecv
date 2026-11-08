"use client";

import * as React from "react";
import { Check, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { CountryDropdown, CountryFlag, parseCountryTokens } from "@/components/ui/country-dropdown";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    getLicenseClasses,
    parseLicenses,
    serializeLicenses,
    type LicenseEntry,
} from "@/lib/driving-license-classes";

export interface DrivingLicenseInputProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

function countryNameToCca2(name: string): string {
    if (!name) return "";
    if (/^[A-Z]{2}$/.test(name)) return name;
    const parsed = parseCountryTokens(name);
    return parsed[0]?.cca2 ?? "";
}

export function DrivingLicenseInput({
    label,
    value,
    onChange,
    className,
}: DrivingLicenseInputProps) {
    const { t } = useTranslation();
    const [entries, setEntries] = React.useState<LicenseEntry[]>(() => parseLicenses(value));

    React.useEffect(() => {
        const parsed = parseLicenses(value);
        if (serializeLicenses(parsed) !== serializeLicenses(entries)) {
            setEntries(parsed);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const commit = (next: LicenseEntry[]) => {
        setEntries(next);
        onChange(serializeLicenses(next));
    };

    const addEntry = () => {
        commit([...entries, { country: "", classes: [] }]);
    };

    const updateEntry = (index: number, patch: Partial<LicenseEntry>) => {
        const next = entries.map((e, i) => (i === index ? { ...e, ...patch } : e));
        commit(next);
    };

    const removeEntry = (index: number) => {
        commit(entries.filter((_, i) => i !== index));
    };

    return (
        <div className={cn("space-y-2", className)}>
            {label && (
                <label className="text-[11px] font-medium text-faint uppercase tracking-wider block">
                    {label}
                </label>
            )}
            <div className="space-y-2">
                {entries.map((entry, index) => (
                    <LicenseRow
                        key={index}
                        entry={entry}
                        onChange={(patch) => updateEntry(index, patch)}
                        onRemove={() => removeEntry(index)}
                    />
                ))}
            </div>
            <button
                type="button"
                onClick={addEntry}
                className="inline-flex items-center gap-1.5 text-xs text-dim hover:text-strong transition-colors px-2 py-1 rounded-md hover:bg-surface-4"
            >
                <Plus className="w-3.5 h-3.5" />
                {t("input.addLicense")}
            </button>
        </div>
    );
}

function LicenseRow({
    entry,
    onChange,
    onRemove,
}: {
    entry: LicenseEntry;
    onChange: (patch: Partial<LicenseEntry>) => void;
    onRemove: () => void;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = React.useState(false);
    const cca2 = countryNameToCca2(entry.country);
    const classes = getLicenseClasses(cca2);
    const selected = new Set(entry.classes.map((c) => c.toLowerCase()));

    const toggleClass = (code: string) => {
        if (selected.has(code.toLowerCase())) {
            onChange({
                classes: entry.classes.filter((c) => c.toLowerCase() !== code.toLowerCase()),
            });
        } else {
            onChange({ classes: [...entry.classes, code] });
        }
    };

    return (
        <div className="rounded-xl border border-edge bg-surface-1 p-2 space-y-2">
            <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                    <CountryDropdown
                        value={entry.country}
                        onChange={(country) => onChange({ country })}
                        placeholder={t("input.issuingCountryOptional")}
                        multiple={false}
                    />
                </div>
                <button
                    type="button"
                    onClick={onRemove}
                    aria-label={t("input.removeLicense")}
                    className="text-faint hover:text-danger transition-colors p-1.5 rounded-md hover:bg-surface-4 shrink-0"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg border border-surface-5 bg-surface-3 py-2 px-3 text-sm text-strong hover:border-faint focus:outline-none focus:border-faint transition-colors min-h-[36px]"
                    >
                        <div className="flex flex-wrap items-center gap-1 flex-1 min-w-0">
                            {entry.classes.length === 0 ? (
                                <span className="text-faint/60 text-xs">
                                    {t("input.licenseClasses")}
                                </span>
                            ) : (
                                entry.classes.map((c) => (
                                    <span
                                        key={c}
                                        className="inline-flex items-center gap-1 bg-surface-4 rounded px-1.5 py-0.5 text-[11px] font-medium"
                                    >
                                        {cca2 && (
                                            <CountryFlag cca2={cca2} name={entry.country} className="h-3 w-4" />
                                        )}
                                        {c}
                                    </span>
                                ))
                            )}
                        </div>
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-[20rem] p-0" align="start">
                    <Command>
                        <CommandInput placeholder={t("input.searchLicenseClass")} />
                        <CommandList>
                            <CommandEmpty>{t("input.noLicenseClass")}</CommandEmpty>
                            <CommandGroup>
                                {classes.map((cls) => {
                                    const isSelected = selected.has(cls.code.toLowerCase());
                                    return (
                                        <CommandItem
                                            key={cls.code}
                                            value={`${cls.code} ${t(cls.descriptionKey)} ${cls.description}`}
                                            onSelect={() => toggleClass(cls.code)}
                                        >
                                            <span className="font-medium text-sm w-20 shrink-0">{cls.code}</span>
                                            <span className="text-xs text-dim flex-1 truncate">
                                                {t(cls.descriptionKey)}
                                            </span>
                                            {isSelected && (
                                                <Check className="h-4 w-4 text-accent ml-1" />
                                            )}
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
