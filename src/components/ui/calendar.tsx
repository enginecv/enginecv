"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DropdownProps } from "react-day-picker";
import { bs, de, enUS, es, fr } from "react-day-picker/locale";
import { useTranslation } from "@/lib/i18n";

import { cn } from "@/lib/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function CalendarDropdown({ value, onChange, options }: DropdownProps) {
    const selected = options?.find((o) => o.value === value);
    const handleChange = (next: string) => {
        if (!onChange) return;
        const event = {
            target: { value: next },
            currentTarget: { value: next },
        } as unknown as React.ChangeEvent<HTMLSelectElement>;
        onChange(event);
    };
    return (
        <Select
            value={value !== undefined ? String(value) : undefined}
            onValueChange={handleChange}
        >
            <SelectTrigger className="h-7 min-w-[5rem]">
                <SelectValue>{selected?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-72">
                {options?.map((opt) => (
                    <SelectItem
                        key={opt.value}
                        value={String(opt.value)}
                        disabled={opt.disabled}
                    >
                        {opt.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function Calendar({
    className,
    classNames,
    showOutsideDays = true,
    captionLayout,
    ...props
}: CalendarProps) {
    const { locale } = useTranslation();
    const isDropdown = captionLayout?.startsWith("dropdown");

    return (
        <DayPicker
            locale={{ en: enUS, bs, de, fr, es }[locale]}
            showOutsideDays={showOutsideDays}
            captionLayout={captionLayout}
            className={cn("p-3", className)}
            classNames={{
                root: "text-strong",
                months: "flex flex-col sm:flex-row gap-4 relative",
                month: "flex flex-col gap-4",
                month_caption: cn(
                    "flex items-center w-full",
                    isDropdown ? "justify-center h-8 px-1" : "h-7 justify-center relative"
                ),
                caption_label: cn(
                    "text-sm font-medium text-strong",
                    isDropdown && "hidden"
                ),
                nav: cn(
                    "flex items-center",
                    isDropdown
                        ? "hidden"
                        : "absolute inset-x-0 top-0 h-7 justify-between px-1"
                ),
                button_previous:
                    "h-7 w-7 cursor-pointer inline-flex items-center justify-center rounded-md bg-transparent text-dim hover:bg-surface-4 hover:text-strong transition-colors disabled:cursor-not-allowed disabled:opacity-30",
                button_next:
                    "h-7 w-7 cursor-pointer inline-flex items-center justify-center rounded-md bg-transparent text-dim hover:bg-surface-4 hover:text-strong transition-colors disabled:cursor-not-allowed disabled:opacity-30",
                dropdowns: "flex items-center justify-center gap-2",
                dropdown_root: "relative inline-flex",
                month_grid: "w-full border-collapse",
                weekdays: "flex w-full",
                weekday:
                    "text-faint w-9 h-8 inline-flex items-center justify-center text-[0.7rem] font-normal uppercase tracking-wider",
                week: "flex w-full mt-0.5",
                day: "h-9 w-9 p-0 text-center text-sm relative focus-within:z-10",
                day_button: cn(
                    "inline-flex items-center justify-center h-9 w-9 rounded-md text-sm font-normal text-strong",
                    "cursor-pointer hover:bg-surface-4 focus:bg-surface-4 focus:outline-none",
                    "transition-colors"
                ),
                selected:
                    "[&>button]:bg-accent [&>button]:text-surface-1 [&>button]:font-medium [&>button]:hover:bg-accent-soft",
                today: "[&>button]:ring-1 [&>button]:ring-accent/40 [&>button]:ring-inset",
                outside: "[&>button]:text-edge-strong",
                disabled: "[&>button]:text-edge [&>button]:pointer-events-none",
                hidden: "invisible",
                ...classNames,
            }}
            components={{
                Chevron: ({ orientation }) => {
                    if (orientation === "right")
                        return <ChevronRight className="h-4 w-4" />;
                    return <ChevronLeft className="h-4 w-4" />;
                },
                Dropdown: CalendarDropdown,
            }}
            {...props}
        />
    );
}
Calendar.displayName = "Calendar";

export { Calendar };
