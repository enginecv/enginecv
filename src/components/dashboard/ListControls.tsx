"use client";

import { useState, type ReactNode } from "react";
import { ArrowUpDown, Check, ChevronDown, ChevronLeft, ChevronRight, Rows3 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DASHBOARD_PAGE_SIZES, type DashboardPageSize, type DashboardSort } from "@/lib/dashboard-list";
import { useTranslation } from "@/lib/i18n";

interface ChoiceMenuProps<T extends string> {
    value: T;
    options: readonly T[];
    label: (value: T) => string;
    onChange: (value: T) => void;
    title: string;
    icon: ReactNode;
    /** Short text next to the icon (e.g. "12"); the full label lives in the menu and the aria-label. */
    shortLabel?: (value: T) => string;
    testId: string;
    className?: string;
}

/**
 * A non-modal popover menu, like the template filter. A Radix Select locks
 * page scrolling while open, which hides the scrollbar and shifts the page.
 */
function ChoiceMenu<T extends string>({ value, options, label, onChange, title, icon, shortLabel, testId, className }: ChoiceMenuProps<T>) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label={`${title}: ${label(value)}`}
                    title={`${title}: ${label(value)}`}
                    data-testid={testId}
                    className={`flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-edge bg-surface-4 px-3 text-sm font-medium text-bright transition-colors hover:border-faint hover:text-strong ${className ?? ""}`}
                >
                    {icon}
                    {shortLabel && <span className="tabular-nums" aria-hidden="true">{shortLabel(value)}</span>}
                    <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 opacity-60 md:block" aria-hidden="true" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-52 p-1.5">
                <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-faint">{title}</p>
                {options.map((option) => {
                    const isActive = option === value;
                    return (
                        <button
                            key={option}
                            type="button"
                            aria-pressed={isActive}
                            onClick={() => {
                                onChange(option);
                                setOpen(false);
                            }}
                            data-testid={`${testId}-${option}`}
                            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                                isActive ? "bg-surface-4 text-strong" : "text-mid hover:bg-surface-4/70 hover:text-strong"
                            }`}
                        >
                            {isActive ? (
                                <Check className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden="true" />
                            ) : (
                                <span className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            )}
                            {label(option)}
                        </button>
                    );
                })}
            </PopoverContent>
        </Popover>
    );
}

interface SortSelectProps {
    value: DashboardSort;
    options: readonly DashboardSort[];
    onChange: (value: DashboardSort) => void;
    /** Label for "updated" where the list has no real edit dates (built-in templates). */
    updatedLabel?: string;
    testId: string;
}

export function SortSelect({ value, options, onChange, updatedLabel, testId }: SortSelectProps) {
    const { t } = useTranslation();
    const label = (sort: DashboardSort) => (sort === "updated" && updatedLabel ? updatedLabel : t(`dashboard.sort.${sort}`));

    return (
        <ChoiceMenu
            value={options.includes(value) ? value : options[0]}
            options={options}
            label={label}
            onChange={onChange}
            title={t("dashboard.sortBy")}
            icon={<ArrowUpDown className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />}
            testId={testId}
        />
    );
}

interface PageSizeSelectProps {
    value: DashboardPageSize;
    onChange: (value: DashboardPageSize) => void;
    testId: string;
}

export function PageSizeSelect({ value, onChange, testId }: PageSizeSelectProps) {
    const { t } = useTranslation();
    const label = (size: DashboardPageSize) => (size === "all" ? t("dashboard.pageSizeAll") : t("dashboard.pageSizeOption", { count: Number(size) }));

    return (
        <ChoiceMenu
            value={value}
            options={DASHBOARD_PAGE_SIZES}
            label={label}
            onChange={onChange}
            title={t("dashboard.pageSize")}
            icon={<Rows3 className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />}
            shortLabel={(size) => (size === "all" ? t("dashboard.pageSizeAllShort") : size)}
            className="hidden sm:flex"
            testId={testId}
        />
    );
}

interface PagerProps {
    page: number;
    pageCount: number;
    onChange: (page: number) => void;
    testId: string;
}

/** Hidden when everything fits on one page. */
export function Pager({ page, pageCount, onChange, testId }: PagerProps) {
    const { t } = useTranslation();
    if (pageCount <= 1) return null;

    const button = "flex h-9 w-9 items-center justify-center rounded-lg border border-edge text-faint transition-colors hover:border-faint hover:text-strong disabled:opacity-35 disabled:hover:border-edge disabled:hover:text-faint";

    return (
        <nav aria-label={t("dashboard.pagination")} data-testid={testId} className="mt-8 flex items-center justify-center gap-3">
            <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} aria-label={t("dashboard.pagePrev")} data-testid={`${testId}-prev`} className={button}>
                <ChevronLeft className="h-4 w-4" />
            </button>
            <span aria-live="polite" data-testid={`${testId}-status`} className="min-w-28 text-center text-sm text-mid">
                {t("dashboard.pageStatus", { page, count: pageCount })}
            </span>
            <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pageCount} aria-label={t("dashboard.pageNext")} data-testid={`${testId}-next`} className={button}>
                <ChevronRight className="h-4 w-4" />
            </button>
        </nav>
    );
}
