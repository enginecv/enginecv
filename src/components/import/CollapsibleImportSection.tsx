"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

interface CollapsibleImportSectionProps {
    title: string;
    subtitle?: string;
    count?: string;
    defaultOpen?: boolean;
    testId?: string;
    children: ReactNode;
}

export function CollapsibleImportSection({
    title,
    subtitle,
    count,
    defaultOpen = true,
    testId,
    children,
}: CollapsibleImportSectionProps) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="rounded-xl border border-edge" data-testid={testId}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-1"
            >
                <ChevronDown
                    className={`h-4 w-4 shrink-0 text-faint transition-transform ${open ? "" : "-rotate-90"}`}
                />
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-strong">{title}</span>
                    {subtitle && open && (
                        <span className="mt-0.5 block text-xs leading-5 text-dim">{subtitle}</span>
                    )}
                </span>
                {count && <span className="shrink-0 text-xs text-dim">{count}</span>}
            </button>
            {open && <div className="px-3 pb-3">{children}</div>}
        </div>
    );
}
