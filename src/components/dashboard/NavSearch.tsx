"use client";

import { Search, X } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";

/**
 * Toolbar search control. On md+ the toolbar has room for a persistent
 * (moderately wide) search field. On narrow screens it collapses to a lens
 * button that opens an overlay search across the toolbar instead of pushing
 * the surrounding controls. `overlayContent` rides next to the field while
 * the overlay is open (e.g. the filter button). Requires a positioned parent.
 */
export function NavSearch({
    value,
    onChange,
    placeholder,
    testId,
    overlayContent,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    testId?: string;
    overlayContent?: ReactNode;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <>
            {/* Persistent field — md+ toolbars have room for it. */}
            <div className="hidden h-10 w-56 shrink-0 items-center rounded-xl border border-edge bg-surface-4 transition-colors focus-within:border-faint md:flex">
                <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center text-faint"
                    aria-hidden="true"
                >
                    <Search className="h-4 w-4" />
                </span>
                <input
                    type="text"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Escape") {
                            event.preventDefault();
                            onChange("");
                        }
                    }}
                    placeholder={placeholder}
                    data-testid={testId}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-strong outline-none placeholder:text-faint/50"
                />
                {value && (
                    <button
                        type="button"
                        onClick={() => onChange("")}
                        aria-label={t("dashboard.clearSearch")}
                        title={t("dashboard.clearSearch")}
                        className="flex h-10 w-9 shrink-0 items-center justify-center text-faint transition-colors hover:text-strong"
                    >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                )}
            </div>

            {/* Compact trigger — narrow screens collapse to a lens button. */}
            <button
                type="button"
                onClick={() => {
                    setOpen(true);
                    requestAnimationFrame(() => inputRef.current?.focus());
                }}
                aria-label={placeholder}
                aria-expanded={open}
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-edge bg-surface-4 text-faint transition-colors hover:border-faint hover:text-strong md:hidden"
            >
                <Search className="h-4 w-4" aria-hidden="true" />
                {value.trim() && (
                    <span
                        className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent"
                        aria-hidden="true"
                    />
                )}
            </button>

            {open && (
                <>
                    {/* Tap anywhere outside the field to collapse the search. */}
                    <div
                        className="fixed inset-0 z-10 md:hidden"
                        aria-hidden="true"
                        onClick={() => setOpen(false)}
                    />
                    <div className="absolute inset-0 z-20 flex items-center gap-2 bg-surface-2 px-4 sm:px-6 md:hidden">
                        <div className="flex h-10 min-w-0 flex-1 items-center rounded-xl border border-edge bg-surface-4 transition-colors focus-within:border-faint">
                            <span
                                className="flex h-10 w-10 shrink-0 items-center justify-center text-faint"
                                aria-hidden="true"
                            >
                                <Search className="h-4 w-4" />
                            </span>
                            <input
                                ref={inputRef}
                                type="text"
                                value={value}
                                onChange={(event) => onChange(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "Escape") {
                                        event.preventDefault();
                                        onChange("");
                                        setOpen(false);
                                    }
                                }}
                                placeholder={placeholder}
                                className="h-full min-w-0 flex-1 bg-transparent text-sm text-strong outline-none placeholder:text-faint/50"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    if (value) {
                                        onChange("");
                                        inputRef.current?.focus();
                                    } else {
                                        setOpen(false);
                                    }
                                }}
                                aria-label={value ? t("dashboard.clearSearch") : t("dashboard.closeSearch")}
                                title={value ? t("dashboard.clearSearch") : t("dashboard.closeSearch")}
                                className="flex h-10 w-10 shrink-0 items-center justify-center text-faint transition-colors hover:text-strong"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>
                        {overlayContent}
                    </div>
                </>
            )}
        </>
    );
}
