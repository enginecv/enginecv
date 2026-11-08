"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import { createId } from "@/lib/id";
import type { EmailEntry } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface MultiEmailInputProps {
    label?: string;
    value: EmailEntry[];
    onChange: (value: EmailEntry[]) => void;
    addressLabel: string;
    addressPlaceholder?: string;
    customLabel: string;
    customLabelPlaceholder?: string;
    addLabel: string;
    removeLabel: string;
    moveUpLabel: string;
    moveDownLabel: string;
    className?: string;
}

export function MultiEmailInput({
    label,
    value,
    onChange,
    addressLabel,
    addressPlaceholder,
    customLabel,
    customLabelPlaceholder,
    addLabel,
    removeLabel,
    moveUpLabel,
    moveDownLabel,
    className,
}: MultiEmailInputProps) {
    const [emptyId] = React.useState(createId);
    const entries = value.length > 0
        ? value
        : [{ id: emptyId, email: "", label: "" }];

    const updateEntry = (id: string, patch: Partial<EmailEntry>) => {
        onChange(entries.map((entry) => entry.id === id ? { ...entry, ...patch } : entry));
    };

    const addEntry = () => {
        onChange([...entries, { id: createId(), email: "", label: "" }]);
    };

    const removeEntry = (id: string) => {
        onChange(entries.filter((entry) => entry.id !== id));
    };

    const moveEntry = (index: number, offset: -1 | 1) => {
        const destination = index + offset;
        if (destination < 0 || destination >= entries.length) return;

        const reordered = [...entries];
        const [entry] = reordered.splice(index, 1);
        reordered.splice(destination, 0, entry);
        onChange(reordered);
    };

    return (
        <div className={cn("space-y-3", className)}>
            {label ? (
                <span className="block text-[11px] font-medium uppercase tracking-wider text-faint">
                    {label}
                </span>
            ) : null}

            <div className="space-y-2">
                {entries.map((entry, index) => (
                    <div
                        key={entry.id}
                        data-testid={`email-entry-${index}`}
                        className="rounded-xl border border-edge bg-surface-2/40 p-2.5"
                    >
                        <div className="flex items-start gap-2">
                            <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1.45fr)_minmax(0,0.75fr)]">
                                <label className="space-y-1.5">
                                    <span className="block text-[10px] font-medium uppercase tracking-wider text-faint">
                                        {addressLabel}
                                    </span>
                                    <Input
                                        type="email"
                                        value={entry.email}
                                        onChange={(event) => updateEntry(entry.id, { email: event.target.value })}
                                        placeholder={addressPlaceholder}
                                        aria-label={`${addressLabel} ${index + 1}`}
                                        data-testid={`email-address-${index}`}
                                        className="h-10"
                                    />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="block text-[10px] font-medium uppercase tracking-wider text-faint">
                                        {customLabel}
                                    </span>
                                    <Input
                                        value={entry.label}
                                        onChange={(event) => updateEntry(entry.id, { label: event.target.value })}
                                        placeholder={customLabelPlaceholder}
                                        aria-label={`${customLabel} ${index + 1}`}
                                        data-testid={`email-label-${index}`}
                                        className="h-10"
                                    />
                                </label>
                            </div>

                            {entries.length > 1 ? (
                                <div className="mt-5 flex shrink-0 flex-col gap-1">
                                    <button
                                        type="button"
                                        onClick={() => moveEntry(index, -1)}
                                        disabled={index === 0}
                                        aria-label={`${moveUpLabel} ${index + 1}`}
                                        data-testid={`move-email-up-${index}`}
                                        className="rounded-md p-1.5 text-faint transition-colors hover:bg-surface-4 hover:text-strong disabled:cursor-not-allowed disabled:opacity-30"
                                    >
                                        <ChevronUp className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => moveEntry(index, 1)}
                                        disabled={index === entries.length - 1}
                                        aria-label={`${moveDownLabel} ${index + 1}`}
                                        data-testid={`move-email-down-${index}`}
                                        className="rounded-md p-1.5 text-faint transition-colors hover:bg-surface-4 hover:text-strong disabled:cursor-not-allowed disabled:opacity-30"
                                    >
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => removeEntry(entry.id)}
                                        aria-label={`${removeLabel} ${index + 1}`}
                                        data-testid={`remove-email-${index}`}
                                        className="rounded-md p-1.5 text-faint transition-colors hover:bg-surface-4 hover:text-danger"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    </div>
                ))}
            </div>

            <button
                type="button"
                onClick={addEntry}
                data-testid="add-email"
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-dim transition-colors hover:bg-surface-4 hover:text-strong"
            >
                <Plus className="h-3.5 w-3.5" />
                {addLabel}
            </button>
        </div>
    );
}
