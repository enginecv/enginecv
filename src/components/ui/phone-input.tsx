"use client";

import * as React from "react";
import { Check, ChevronDown, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import RPNInput, {
    type Country,
    type Value as E164Number,
    getCountryCallingCode,
    parsePhoneNumber,
} from "react-phone-number-input";
import flags from "react-phone-number-input/flags";
import { getExampleNumber } from "libphonenumber-js";
import phoneExamples from "libphonenumber-js/examples.mobile.json";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
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

import "react-phone-number-input/style.css";

export interface PhoneInputProps {
    label?: string;
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    defaultCountry?: Country;
    className?: string;
}

function deriveInitialCountry(value: string | undefined, fallback: Country): Country {
    if (!value) return fallback;
    try {
        const parsed = parsePhoneNumber(value);
        return (parsed?.country as Country) ?? fallback;
    } catch {
        return fallback;
    }
}

function examplePlaceholder(country: Country): string {
    const example = getExampleNumber(country, phoneExamples as Parameters<typeof getExampleNumber>[1]);
    return example?.formatNational() ?? "";
}

export function PhoneInput({
    label,
    value,
    onChange,
    placeholder,
    defaultCountry = "US",
    className,
}: PhoneInputProps) {
    const { t } = useTranslation();
    const [country, setCountry] = React.useState<Country>(() =>
        deriveInitialCountry(value, defaultCountry)
    );
    const dynamicPlaceholder = placeholder ?? (examplePlaceholder(country) || t("input.phoneNumber"));

    return (
        <div className={cn("space-y-2", className)}>
            {label && (
                <label className="text-[11px] font-medium text-faint uppercase tracking-wider block">
                    {label}
                </label>
            )}
            <RPNInput
                className="flex w-full"
                flagComponent={FlagComponent}
                countrySelectComponent={CountrySelect}
                inputComponent={PhoneNumberInput}
                country={country}
                onCountryChange={(c) => c && setCountry(c)}
                defaultCountry={defaultCountry}
                placeholder={dynamicPlaceholder}
                value={(value as E164Number) || ""}
                onChange={(v) => onChange(v ?? "")}
            />
        </div>
    );
}

export function parsePhones(value: string): string[] {
    if (!value.trim()) return [];
    return value
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
}

export function serializePhones(phones: string[]): string {
    return phones.filter(Boolean).join("; ");
}

export interface MultiPhoneInputProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    defaultCountry?: Country;
    addLabel?: string;
    className?: string;
}

export function MultiPhoneInput({
    label,
    value,
    onChange,
    defaultCountry = "US",
    addLabel,
    className,
}: MultiPhoneInputProps) {
    const { t } = useTranslation();
    addLabel ??= t("editor.addPhone");
    const [phones, setPhones] = React.useState<string[]>(() => {
        const parsed = parsePhones(value);
        return parsed.length === 0 ? [""] : parsed;
    });

    React.useEffect(() => {
        const parsed = parsePhones(value);
        const incoming = parsed.length === 0 ? [""] : parsed;
        if (serializePhones(incoming) !== serializePhones(phones)) {
            setPhones(incoming);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const commit = (next: string[]) => {
        setPhones(next);
        onChange(serializePhones(next));
    };

    const addEntry = () => commit([...phones, ""]);
    const updateEntry = (i: number, next: string) =>
        commit(phones.map((p, idx) => (idx === i ? next : p)));
    const removeEntry = (i: number) => {
        const filtered = phones.filter((_, idx) => idx !== i);
        commit(filtered.length === 0 ? [""] : filtered);
    };

    return (
        <div className={cn("space-y-2", className)}>
            {label && (
                <label className="text-[11px] font-medium text-faint uppercase tracking-wider block">
                    {label}
                </label>
            )}
            <div className="space-y-2">
                {phones.map((phone, index) => (
                    <div key={index} className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                            <PhoneInput
                                value={phone}
                                onChange={(v) => updateEntry(index, v)}
                                defaultCountry={defaultCountry}
                            />
                        </div>
                        {phones.length > 1 && (
                            <button
                                type="button"
                                onClick={() => removeEntry(index)}
                                aria-label={t("input.removePhone")}
                                className="text-faint hover:text-danger transition-colors p-1.5 rounded-md hover:bg-surface-4 shrink-0 mt-1"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        )}
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

const PhoneNumberInput = React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
    <Input
        {...props}
        ref={ref}
        className={cn("rounded-l-none rounded-r-xl -ml-px flex-1", className)}
    />
));
PhoneNumberInput.displayName = "PhoneNumberInput";

type CountrySelectProps = {
    disabled?: boolean;
    value: Country;
    onChange: (value: Country) => void;
    options: { label: string; value: Country | undefined }[];
};

function CountrySelect({
    disabled,
    value,
    onChange,
    options,
}: CountrySelectProps) {
    const { t, locale } = useTranslation();
    const [open, setOpen] = React.useState(false);
    const filtered = React.useMemo(
        () =>
            options.filter(
                (o): o is { label: string; value: Country } => Boolean(o.value)
            ),
        [options]
    );
    const callingCode = value ? `+${getCountryCallingCode(value)}` : "";

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    aria-label={t("input.selectCountry")}
                    className="inline-flex items-center gap-2 rounded-l-xl rounded-r-none border border-edge border-r-0 bg-surface-1 px-3 py-2.5 text-sm text-strong hover:border-faint focus:outline-none focus:border-faint transition-colors disabled:opacity-50 min-w-[6.5rem]"
                >
                    <FlagComponent country={value} countryName={value} />
                    <span className="text-sm text-strong tabular-nums">{callingCode}</span>
                    <ChevronDown className="h-3.5 w-3.5 opacity-60 ml-auto" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[20rem] p-0" align="start">
                <Command>
                    <CommandInput placeholder={t("country.search")} />
                    <CommandList>
                        <CommandEmpty>{t("country.empty")}</CommandEmpty>
                        <CommandGroup>
                            {filtered.map((opt) => {
                                const selected = opt.value === value;
                                const countryName = new Intl.DisplayNames([locale], { type: "region" }).of(opt.value) ?? opt.label;
                                return (
                                    <CommandItem
                                        key={opt.value}
                                        value={`${countryName} ${opt.label} ${opt.value} +${getCountryCallingCode(opt.value)}`}
                                        onSelect={() => {
                                            onChange(opt.value);
                                            setOpen(false);
                                        }}
                                    >
                                        <FlagComponent
                                            country={opt.value}
                                            countryName={countryName}
                                        />
                                        <span className="flex-1 truncate">{countryName}</span>
                                        <span className="text-xs text-faint tabular-nums">
                                            +{getCountryCallingCode(opt.value)}
                                        </span>
                                        {selected && (
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
    );
}

function FlagComponent({
    country,
    countryName,
}: {
    country: Country;
    countryName: string;
}) {
    const Flag = flags[country];
    return (
        <span className="inline-flex h-4 w-6 overflow-hidden rounded-sm bg-surface-4 shrink-0">
            {Flag ? (
                <Flag title={countryName} />
            ) : (
                <ChevronsUpDown className="h-4 w-4 text-faint" />
            )}
        </span>
    );
}
