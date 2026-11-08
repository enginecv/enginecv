"use client";

import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import countries from "world-countries";
import rpniFlags from "react-phone-number-input/flags";

import { cn } from "@/lib/utils";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTranslation } from "@/lib/i18n";

type Cca2 = string;

type CountryEntry = {
    cca2: Cca2;
    name: string;
    demonym: string;
    flagEmoji: string;
};

export type CountryNameStyle = "country" | "nationality";

const NATIONALITY_OVERRIDES: Record<string, Record<string, string>> = {
    bs: {
        BA: "Bosansko", RS: "Srpsko", HR: "Hrvatsko", ME: "Crnogorsko",
        XK: "Kosovsko", MK: "Makedonsko", SI: "Slovensko", DE: "Njemačko",
        AT: "Austrijsko", CH: "Švicarsko", US: "Američko", GB: "Britansko",
    },
    sr: {
        BA: "Bosansko", RS: "Srpsko", HR: "Hrvatsko", ME: "Crnogorsko",
        XK: "Kosovsko", MK: "Makedonsko", SI: "Slovenačko", DE: "Nemačko",
        AT: "Austrijsko", CH: "Švajcarsko", US: "Američko", GB: "Britansko",
    },
    hr: {
        BA: "Bosanskohercegovačko", RS: "Srpsko", HR: "Hrvatsko", ME: "Crnogorsko",
        XK: "Kosovsko", MK: "Makedonsko", SI: "Slovensko", DE: "Njemačko",
        AT: "Austrijsko", CH: "Švicarsko", US: "Američko", GB: "Britansko",
    },
};

const COUNTRY_LIST: CountryEntry[] = countries
    .map((c) => {
        const demonym =
            c.demonyms?.eng?.m ||
            c.demonyms?.eng?.f ||
            c.name.common;
        return {
            cca2: c.cca2,
            name: c.name.common,
            demonym,
            flagEmoji: c.flag,
        };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

const BY_NAME = new Map(COUNTRY_LIST.map((c) => [c.name.toLowerCase(), c]));
const BY_DEMONYM = new Map(
    COUNTRY_LIST.map((c) => [c.demonym.toLowerCase(), c])
);
const BY_CCA2 = new Map(COUNTRY_LIST.map((c) => [c.cca2.toLowerCase(), c]));

export function lookupCountry(token: string): CountryEntry | undefined {
    const key = token.trim().toLowerCase();
    return BY_CCA2.get(key) ?? BY_NAME.get(key) ?? BY_DEMONYM.get(key);
}

export function CountryFlag({
    cca2,
    name,
    className,
}: {
    cca2: Cca2;
    name: string;
    className?: string;
}) {
    const Flag = (rpniFlags as Record<string, React.ComponentType<{ title?: string }>>)[
        cca2 as keyof typeof rpniFlags
    ];
    return (
        <span
            className={cn(
                "inline-flex h-4 w-6 overflow-hidden rounded-sm bg-surface-4 shrink-0",
                className
            )}
        >
            {Flag ? <Flag title={name} /> : null}
        </span>
    );
}

export function parseCountryTokens(value: string): { cca2: string; name: string; demonym?: string }[] {
    if (!value) return [];
    return value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((token) => {
            const match = lookupCountry(token);
            if (match) return { cca2: match.cca2, name: match.name, demonym: match.demonym };
            return { cca2: "", name: token };
        });
}

export type CountryDisplayMode =
    | "hide"
    | "flag"
    | "code"
    | "name"
    | "flagCode"
    | "both";

export type CountryNameMode = "none" | "code" | "full";

export interface DecomposedMode {
    flag: boolean;
    name: CountryNameMode;
}

export function decomposeMode(mode: CountryDisplayMode): DecomposedMode {
    switch (mode) {
        case "hide": return { flag: false, name: "none" };
        case "flag": return { flag: true, name: "none" };
        case "code": return { flag: false, name: "code" };
        case "name": return { flag: false, name: "full" };
        case "flagCode": return { flag: true, name: "code" };
        case "both": return { flag: true, name: "full" };
    }
}

export function composeMode(flag: boolean, name: CountryNameMode): CountryDisplayMode {
    if (!flag && name === "none") return "hide";
    if (flag && name === "none") return "flag";
    if (!flag && name === "code") return "code";
    if (!flag && name === "full") return "name";
    if (flag && name === "code") return "flagCode";
    return "both";
}

/** Returns the text to render for a country given the display mode. */
export function countryDisplayText(
    tok: { cca2: string; name: string; demonym?: string },
    mode: CountryDisplayMode,
    options: { nameStyle?: CountryNameStyle; language?: string } = {},
): string {
    const { name } = decomposeMode(mode);
    if (name === "code") return tok.cca2 || tok.name;
    if (name === "full") {
        if (options.nameStyle !== "nationality") return tok.name;
        const language = options.language?.split("-")[0] || "en";
        const override = NATIONALITY_OVERRIDES[language]?.[tok.cca2];
        if (override) return override;
        if (language === "en" && tok.demonym) return tok.demonym;
        try {
            return tok.cca2
                ? new Intl.DisplayNames([options.language || language], { type: "region" }).of(tok.cca2) || tok.name
                : tok.name;
        } catch {
            return tok.demonym || tok.name;
        }
    }
    return "";
}

export function shouldShowFlag(mode: CountryDisplayMode): boolean {
    return decomposeMode(mode).flag;
}

export function shouldShowText(mode: CountryDisplayMode): boolean {
    return decomposeMode(mode).name !== "none";
}

export interface CountryDropdownProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    /** Display mode for chips and list rows. Default "both". */
    display?: CountryDisplayMode;
    nameStyle?: CountryNameStyle;
    language?: string;
    /** Allow multiple selections. Default true. */
    multiple?: boolean;
}

export interface CountryDisplayToggleProps {
    value: CountryDisplayMode;
    onChange: (mode: CountryDisplayMode) => void;
    label?: string;
    className?: string;
    nameStyle?: CountryNameStyle;
    onNameStyleChange?: (style: CountryNameStyle) => void;
}

export function CountryDisplayToggle({
    value,
    onChange,
    label,
    className,
    nameStyle,
    onNameStyleChange,
}: CountryDisplayToggleProps) {
    const { t } = useTranslation();
    const { flag, name } = decomposeMode(value);
    const setFlag = (next: string) => {
        if (next !== "on" && next !== "off") return;
        onChange(composeMode(next === "on", name));
    };
    const setName = (next: string) => {
        if (next !== "none" && next !== "code" && next !== "full") return;
        onChange(composeMode(flag, next as CountryNameMode));
    };
    return (
        <div className={cn("space-y-1.5", className)}>
            <span className="text-[10px] uppercase tracking-wider text-faint">
                {label ?? t("country.showInPreview")}
            </span>
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-dim w-12 shrink-0">{t("country.flag")}</span>
                <ToggleGroup
                    type="single"
                    value={flag ? "on" : "off"}
                    onValueChange={setFlag}
                    aria-label={t("country.flag")}
                >
                    <ToggleGroupItem value="on" aria-label={t("country.show")}>{t("country.show")}</ToggleGroupItem>
                    <ToggleGroupItem value="off" aria-label={t("country.hide")}>{t("country.hide")}</ToggleGroupItem>
                </ToggleGroup>
            </div>
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-dim w-12 shrink-0">{t("country.name")}</span>
                <ToggleGroup
                    type="single"
                    value={name}
                    onValueChange={setName}
                    aria-label={t("country.name")}
                >
                    <ToggleGroupItem value="code" aria-label={t("country.code")}>{t("country.code")}</ToggleGroupItem>
                    <ToggleGroupItem value="full" aria-label={t("country.full")}>{t("country.full")}</ToggleGroupItem>
                    <ToggleGroupItem value="none" aria-label={t("country.hide")}>{t("country.hide")}</ToggleGroupItem>
                </ToggleGroup>
            </div>
            {nameStyle && onNameStyleChange && name === "full" ? (
                <div className="flex items-center justify-end gap-1">
                    <ToggleGroup
                        type="single"
                        value={nameStyle}
                        onValueChange={(next) => {
                            if (next === "country" || next === "nationality") onNameStyleChange(next);
                        }}
                        aria-label={t("country.name")}
                    >
                        <ToggleGroupItem value="country">{t("country.country")}</ToggleGroupItem>
                        <ToggleGroupItem value="nationality">{t("country.nationality")}</ToggleGroupItem>
                    </ToggleGroup>
                </div>
            ) : null}
        </div>
    );
}

function parseSelected(value: string): CountryEntry[] {
    if (!value) return [];
    return value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((token) => {
            const key = token.toLowerCase();
            const match = BY_NAME.get(key) ?? BY_DEMONYM.get(key);
            if (match) return match;
            return {
                cca2: "",
                name: token,
                demonym: token,
                flagEmoji: "",
            };
        });
}

export function CountryDropdown({
    label,
    value,
    onChange,
    placeholder = "Select nationality",
    className,
    display = "both",
    nameStyle = "country",
    language = "en",
    multiple = true,
}: CountryDropdownProps) {
    const { t } = useTranslation();
    const resolvedPlaceholder = placeholder === "Select nationality"
        ? t("country.selectNationality")
        : placeholder;
    const showFlag = shouldShowFlag(display);
    const showText = shouldShowText(display);
    const [open, setOpen] = React.useState(false);
    const selected = React.useMemo(() => parseSelected(value), [value]);
    const keyOf = (c: CountryEntry) =>
        (c.cca2 || c.name).toLowerCase();
    const selectedKeys = React.useMemo(
        () => new Set(selected.map(keyOf)),
        [selected]
    );

    const commit = (next: CountryEntry[]) => {
        onChange(next.map((c) => c.name).join(", "));
    };

    const toggle = (entry: CountryEntry) => {
        const k = keyOf(entry);
        if (selectedKeys.has(k)) {
            commit(selected.filter((s) => keyOf(s) !== k));
        } else if (multiple) {
            commit([...selected, entry]);
        } else {
            commit([entry]);
            setOpen(false);
        }
    };

    const remove = (entry: CountryEntry) => {
        const k = keyOf(entry);
        commit(selected.filter((s) => keyOf(s) !== k));
    };

    return (
        <div className={cn("space-y-2", className)}>
            {label && (
                <label className="text-[11px] font-medium text-faint uppercase tracking-wider block">
                    {label}
                </label>
            )}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-xl border border-edge bg-surface-1 py-2 px-3 text-sm text-strong hover:border-faint focus:outline-none focus:border-faint transition-colors min-h-[42px]"
                    >
                        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                            {selected.length === 0 ? (
                                <span className="text-faint/60">{resolvedPlaceholder}</span>
                            ) : (
                                selected.map((entry) => (
                                    <span
                                        key={entry.cca2 || entry.name}
                                        title={entry.name}
                                        className="inline-flex items-center gap-1.5 bg-surface-4 rounded-lg px-2 py-1 text-xs"
                                    >
                                        {showFlag && entry.cca2 && (
                                            <CountryFlag cca2={entry.cca2} name={entry.name} />
                                        )}
                                        {showText && (
                                            <span>{countryDisplayText(entry, display, { nameStyle, language })}</span>
                                        )}
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            aria-label={t("editor.removeField", { name: entry.name })}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                remove(entry);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    remove(entry);
                                                }
                                            }}
                                            className="text-faint hover:text-danger transition-colors cursor-pointer"
                                        >
                                            <X className="w-3 h-3" />
                                        </span>
                                    </span>
                                ))
                            )}
                        </div>
                        <ChevronDown className="h-4 w-4 text-faint shrink-0" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-[22rem] p-0" align="start">
                    <Command>
                        <CommandInput placeholder={t("country.search")} />
                        <CommandList>
                            <CommandEmpty>{t("country.empty")}</CommandEmpty>
                            <CommandGroup>
                                {COUNTRY_LIST.map((entry) => {
                                    const isSelected = selectedKeys.has(
                                        entry.cca2.toLowerCase()
                                    );
                                    return (
                                        <CommandItem
                                            key={entry.cca2}
                                            value={`${entry.name} ${entry.demonym} ${entry.cca2}`}
                                            onSelect={() => toggle(entry)}
                                        >
                                            {showFlag && (
                                                <CountryFlag cca2={entry.cca2} name={entry.name} />
                                            )}
                                            <span className="flex-1 truncate">{entry.name}</span>
                                            {display === "code" && (
                                                <span className="text-xs text-faint tabular-nums">
                                                    {entry.cca2}
                                                </span>
                                            )}
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
