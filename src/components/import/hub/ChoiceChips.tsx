"use client";

import type { ReactNode } from "react";

export interface ChoiceChipOption {
    id: string;
    /** Where this version comes from, shown small above the value. */
    source: string;
    /** The value itself (text or a thumbnail). */
    value: ReactNode;
    /** Accessible name of the radio, for example "Use for Headline: a.json". */
    ariaLabel: string;
}

interface ChoiceChipsProps {
    legend: string;
    name: string;
    options: ChoiceChipOption[];
    chosen: string;
    onPick: (optionId: string) => void;
}

/**
 * One group of versions to pick between, laid out side by side as selectable chips
 * instead of a tall stack of radio rows. Each chip is still a real radio input, so
 * keyboard (arrow keys) and screen readers behave as for any radio group.
 */
export function ChoiceChips({ legend, name, options, chosen, onPick }: ChoiceChipsProps) {
    return (
        <fieldset className="min-w-0">
            <legend className="mb-1.5 text-xs font-medium text-faint">{legend}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
                {options.map((option) => (
                    <label
                        key={option.id}
                        className="relative flex min-h-11 cursor-pointer flex-col justify-center rounded-lg border border-edge px-3 py-2 text-sm transition-colors hover:bg-surface-4 has-[:checked]:border-accent has-[:checked]:bg-accent/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent"
                    >
                        <input
                            type="radio"
                            name={name}
                            value={option.id}
                            checked={chosen === option.id}
                            onChange={() => onPick(option.id)}
                            aria-label={option.ariaLabel}
                            className="sr-only"
                        />
                        <span className="block truncate text-[11px] uppercase tracking-wide text-faint">{option.source}</span>
                        <span className="line-clamp-3 break-words text-bright">{option.value}</span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}
