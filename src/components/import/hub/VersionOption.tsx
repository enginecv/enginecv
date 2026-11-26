import type { ReactNode } from "react";
import { ChoiceInput } from "./ChoiceInput";

interface VersionOptionProps {
    /** Radio group name: one per field. */
    name: string;
    checked: boolean;
    onPick: () => void;
    ariaLabel: string;
    /** Where this version comes from: the CV itself or a source's name. */
    source: string;
    children: ReactNode;
}

/** One version of a field to pick from: a card with where it comes from and what it says. */
export function VersionOption({ name, checked, onPick, ariaLabel, source, children }: VersionOptionProps) {
    return (
        <label
            className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${checked ? "border-accent bg-accent/5" : "border-edge hover:border-edge-strong hover:bg-surface-3"}`}
        >
            <span className="mt-0.5">
                <ChoiceInput type="radio" name={name} checked={checked} onChange={onPick} aria-label={ariaLabel} />
            </span>
            <span className="min-w-0 flex-1">
                <span className={`block text-xs font-medium ${checked ? "text-accent" : "text-faint"}`}>{source}</span>
                <span className="mt-0.5 block break-words text-bright">{children}</span>
            </span>
        </label>
    );
}
