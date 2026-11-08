"use client";

import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";
import { getCvLanguageLabels, getCvMonthNames } from "@/lib/cv-language";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

const DATE_FORMAT = "yyyy-MM-dd";
const MONTH_FORMAT = "yyyy-MM";
const YEAR_FORMAT = "yyyy";

type DatePrecision = "day" | "month" | "year";

const PRECISION_HINTS: Record<DatePrecision, string> = {
    day: "YYYY-MM-DD",
    month: "YYYY-MM",
    year: "YYYY",
};

export interface DatePickerProps {
    label?: string;
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    icon?: LucideIcon;
    className?: string;
    precision?: DatePrecision;
    allowPresent?: boolean;
    language?: string;
}

function getPrecisionFormat(precision: DatePrecision) {
    if (precision === "year") return YEAR_FORMAT;
    if (precision === "month") return MONTH_FORMAT;
    return DATE_FORMAT;
}

function parseDateValue(raw: string): Date | undefined {
    if (!raw || raw === "Present") return undefined;
    const formats = [DATE_FORMAT, MONTH_FORMAT, YEAR_FORMAT, "MM/yyyy"];

    for (const candidate of formats) {
        const parsed = parse(raw, candidate, new Date());
        if (isValid(parsed) && format(parsed, candidate) === raw) {
            return parsed;
        }
    }

    return undefined;
}

function formatForPrecision(date: Date, precision: DatePrecision) {
    return format(date, getPrecisionFormat(precision));
}

function inputPrecision(raw: string): DatePrecision | null {
    if (/^\d{4}$/.test(raw)) return "year";
    if (/^(?:\d{4}-\d{2}|\d{2}\/\d{4})$/.test(raw)) return "month";
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "day";
    return null;
}

function formatParsedInput(date: Date, raw: string, precision: DatePrecision) {
    const enteredPrecision = inputPrecision(raw);
    if (precision === "year" || enteredPrecision === "year") return formatForPrecision(date, "year");
    if (precision === "month" || enteredPrecision === "month") return formatForPrecision(date, "month");
    return formatForPrecision(date, "day");
}

function normalizeToken(value: string) {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase()
        .trim();
}

function displayValueForPrecision(
    raw: string,
    precision: DatePrecision,
    presentLabel: string,
) {
    if (!raw) return raw;
    if (raw === "Present") return presentLabel;
    const parsed = parseDateValue(raw);
    return parsed ? formatParsedInput(parsed, raw, precision) : raw;
}

function normalizeInput(
    raw: string,
    precision: DatePrecision,
    allowPresent: boolean,
    presentLabel: string,
) {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    if (
        allowPresent
        && ["present", presentLabel].some((token) => normalizeToken(token) === normalizeToken(trimmed))
    ) {
        return "Present";
    }

    const parsed = parseDateValue(trimmed);
    return parsed ? formatParsedInput(parsed, trimmed, precision) : null;
}

function DatePickerBase({
    label,
    value,
    onChange,
    placeholder,
    icon: Icon = CalendarIcon,
    className,
    precision = "day",
    allowPresent = false,
    language,
    captionLayout,
    startMonth,
    endMonth,
    defaultMonth,
    disabled,
}: DatePickerProps & {
    captionLayout?: React.ComponentProps<typeof Calendar>["captionLayout"];
    startMonth?: Date;
    endMonth?: Date;
    defaultMonth?: Date;
    disabled?: React.ComponentProps<typeof Calendar>["disabled"];
}) {
    const { t, locale } = useTranslation();
    language ??= locale;
    const presentLabel = getCvLanguageLabels(language).present;
    const hint = PRECISION_HINTS[precision];
    const resolvedPlaceholder = placeholder ?? (allowPresent
        ? t("datePicker.formatOrPresent", { format: hint, present: presentLabel })
        : hint);
    const parsedFromValue = React.useMemo(() => parseDateValue(value ?? ""), [value]);
    const displayedValue = React.useMemo(
        () => displayValueForPrecision(value ?? "", precision, presentLabel),
        [precision, presentLabel, value]
    );
    const [text, setText] = React.useState(displayedValue);
    const [open, setOpen] = React.useState(false);
    const [month, setMonth] = React.useState<Date | undefined>(
        parsedFromValue ?? defaultMonth
    );

    React.useEffect(() => {
        setText(displayedValue);
        if (parsedFromValue) setMonth(parsedFromValue);
    }, [displayedValue, parsedFromValue]);

    const commitText = (raw: string) => {
        const normalized = normalizeInput(raw, precision, allowPresent, presentLabel);
        if (normalized !== null) {
            onChange(normalized);
            setText(displayValueForPrecision(normalized, precision, presentLabel));
            const parsed = parseDateValue(normalized);
            if (parsed) setMonth(parsed);
        }
    };

    const handlePickerSelect = (date: Date) => {
        const next = formatForPrecision(date, precision);
        onChange(next);
        setText(next);
        setMonth(date);
        setOpen(false);
    };

    return (
        <div className={cn("space-y-1.5", className)}>
            {label && (
                <label className="text-[11px] font-medium text-faint uppercase tracking-wider block">
                    {label}
                </label>
            )}
            <div className="relative">
                <Input
                    value={text}
                    placeholder={resolvedPlaceholder}
                    onChange={(e) => {
                        setText(e.target.value);
                        const normalized = normalizeInput(e.target.value, precision, allowPresent, presentLabel);
                        if (normalized !== null) {
                            onChange(normalized);
                            const parsed = parseDateValue(normalized);
                            if (parsed) setMonth(parsed);
                        }
                    }}
                    onBlur={(e) => commitText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            commitText(text);
                        }
                        if (e.key === "ArrowDown" && !open) {
                            e.preventDefault();
                            setOpen(true);
                        }
                    }}
                    className="pr-10"
                    inputMode={allowPresent ? "text" : "numeric"}
                    aria-label={label ? `${label} (${hint})` : hint}
                />
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t("datePicker.openCalendar")}
                            className="absolute right-1.5 top-1/2 z-[1] -translate-y-1/2 h-7 w-7 rounded-md"
                        >
                            <Icon className="w-4 h-4" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="z-[200] w-auto p-0 pointer-events-auto" align="end">
                        {precision === "day" ? (
                            <Calendar
                                mode="single"
                                selected={parsedFromValue}
                                month={month}
                                onMonthChange={setMonth}
                                captionLayout={captionLayout}
                                startMonth={startMonth}
                                endMonth={endMonth}
                                disabled={disabled}
                                onSelect={(date) => {
                                    if (!date) {
                                        onChange("");
                                        setText("");
                                        setOpen(false);
                                        return;
                                    }
                                    handlePickerSelect(date);
                                }}
                                autoFocus
                            />
                        ) : (
                            <MonthYearPicker
                                precision={precision}
                                value={parsedFromValue}
                                language={language}
                                startMonth={startMonth}
                                endMonth={endMonth}
                                defaultMonth={defaultMonth}
                                onSelect={handlePickerSelect}
                            />
                        )}
                    </PopoverContent>
                </Popover>
            </div>
            <p className="text-[10px] text-faint leading-none">
                {t("datePicker.typeHint", { format: resolvedPlaceholder })}
            </p>
            {allowPresent ? (
                <button
                    type="button"
                    aria-pressed={value === "Present"}
                    onClick={() => {
                        const next = value === "Present" ? "" : "Present";
                        onChange(next);
                        setText(next ? presentLabel : "");
                    }}
                    className={cn(
                        "rounded-md border px-2 py-1 text-[11px] transition-colors",
                        value === "Present"
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-edge text-faint hover:border-faint hover:text-strong",
                    )}
                >
                    {presentLabel}
                </button>
            ) : null}
        </div>
    );
}

function MonthYearPicker({
    precision,
    value,
    language,
    startMonth,
    endMonth,
    defaultMonth,
    onSelect,
}: {
    precision: Exclude<DatePrecision, "day">;
    value?: Date;
    language: string;
    startMonth?: Date;
    endMonth?: Date;
    defaultMonth?: Date;
    onSelect: (date: Date) => void;
}) {
    const { t } = useTranslation();
    const today = new Date();
    const initialYear = value?.getFullYear() ?? defaultMonth?.getFullYear() ?? today.getFullYear();
    const [viewYear, setViewYear] = React.useState(initialYear);
    const minYear = startMonth?.getFullYear();
    const maxYear = endMonth?.getFullYear();
    const monthLabels = React.useMemo(
        () => getCvMonthNames(language, "short"),
        [language]
    );

    const canUseYear = (year: number) =>
        (minYear === undefined || year >= minYear) && (maxYear === undefined || year <= maxYear);

    const canUseMonth = (monthIndex: number) => {
        const candidate = new Date(viewYear, monthIndex, 1);
        return (!startMonth || candidate >= new Date(startMonth.getFullYear(), startMonth.getMonth(), 1))
            && (!endMonth || candidate <= new Date(endMonth.getFullYear(), endMonth.getMonth(), 1));
    };

    const yearGridStart = Math.floor(viewYear / 12) * 12;
    const years = Array.from({ length: 12 }, (_, index) => yearGridStart + index);
    const selectedYear = value?.getFullYear();
    const selectedMonth = value?.getMonth();

    return (
        <div className="w-72 p-3 text-strong">
            <div className="mb-3 flex items-center justify-between gap-2">
                <button
                    type="button"
                    onClick={() => setViewYear((year) => year - (precision === "year" ? 12 : 1))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-dim transition-colors hover:bg-surface-4 hover:text-strong"
                    aria-label={t(precision === "year" ? "datePicker.previousYears" : "datePicker.previousYear")}
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="text-sm font-medium">
                    {precision === "year" ? `${yearGridStart}-${yearGridStart + 11}` : viewYear}
                </div>
                <button
                    type="button"
                    onClick={() => setViewYear((year) => year + (precision === "year" ? 12 : 1))}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-dim transition-colors hover:bg-surface-4 hover:text-strong"
                    aria-label={t(precision === "year" ? "datePicker.nextYears" : "datePicker.nextYear")}
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {precision === "month" ? (
                <div className="grid grid-cols-3 gap-1.5">
                    {monthLabels.map((label, monthIndex) => {
                        const selected = selectedYear === viewYear && selectedMonth === monthIndex;
                        return (
                            <button
                                key={label}
                                type="button"
                                disabled={!canUseMonth(monthIndex)}
                                onClick={() => onSelect(new Date(viewYear, monthIndex, 1))}
                                className={cn(
                                    "h-10 rounded-md text-sm transition-colors hover:bg-surface-4 disabled:pointer-events-none disabled:text-edge",
                                    selected ? "bg-accent font-medium text-surface-1 hover:bg-accent-soft" : "text-strong"
                                )}
                                aria-label={`${label} ${viewYear}`}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-1.5">
                    {years.map((year) => {
                        const selected = selectedYear === year;
                        return (
                            <button
                                key={year}
                                type="button"
                                disabled={!canUseYear(year)}
                                onClick={() => onSelect(new Date(year, 0, 1))}
                                className={cn(
                                    "h-10 rounded-md text-sm transition-colors hover:bg-surface-4 disabled:pointer-events-none disabled:text-edge",
                                    selected ? "bg-accent font-medium text-surface-1 hover:bg-accent-soft" : "text-strong"
                                )}
                            >
                                {year}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export function DatePicker(props: DatePickerProps) {
    return <DatePickerBase {...props} />;
}

export interface DateOfBirthPickerProps extends DatePickerProps {
    minYear?: number;
    maxYear?: number;
}

export function DateOfBirthPicker({
    label,
    minYear = 1900,
    maxYear = new Date().getFullYear(),
    ...rest
}: DateOfBirthPickerProps) {
    const { t } = useTranslation();
    return (
        <DatePickerBase
            label={label ?? t("form.dateOfBirth")}
            {...rest}
            captionLayout="dropdown"
            startMonth={new Date(minYear, 0)}
            endMonth={new Date(maxYear, 11)}
            defaultMonth={new Date(maxYear - 25, 0, 1)}
            disabled={{ after: new Date() }}
        />
    );
}
