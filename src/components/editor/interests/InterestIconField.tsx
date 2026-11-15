"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { formatLucideIcon, parseInterestIcon } from "@/lib/interests/icon";
import { searchInterestIcons } from "@/lib/interests/icon-catalog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InterestIconView } from "./InterestIconView";

const GRID_COLUMNS = 7;

/**
 * Icon field for the interest entry form: opens a popover with a search box
 * over the curated catalog, a keyboard-navigable grid, a field for a typed
 * emoji, and "Clear icon". `onChange(undefined)` removes the icon.
 */
export function InterestIconField({
    value,
    onChange,
}: {
    value: string | undefined;
    onChange: (next: string | undefined) => void;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [emojiText, setEmojiText] = useState("");
    const [emojiError, setEmojiError] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const searchRef = useRef<HTMLInputElement | null>(null);

    const current = parseInterestIcon(value);
    const results = useMemo(() => searchInterestIcons(query), [query]);

    useEffect(() => {
        if (!open) return;
        setQuery("");
        setActiveIndex(0);
        setEmojiError(false);
        setEmojiText(current?.kind === "emoji" ? current.glyph : "");
        // Reset only when the popover opens.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        setActiveIndex(0);
    }, [query]);

    const choose = (next: string | undefined) => {
        onChange(next);
        setOpen(false);
    };

    const focusOption = (index: number) => {
        const bounded = Math.max(0, Math.min(results.length - 1, index));
        setActiveIndex(bounded);
        optionRefs.current[bounded]?.focus();
    };

    const onGridKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const moves: Record<string, number> = {
            ArrowRight: 1,
            ArrowLeft: -1,
            ArrowDown: GRID_COLUMNS,
            ArrowUp: -GRID_COLUMNS,
        };
        if (event.key in moves) {
            event.preventDefault();
            focusOption(activeIndex + moves[event.key]);
        } else if (event.key === "Home") {
            event.preventDefault();
            focusOption(0);
        } else if (event.key === "End") {
            event.preventDefault();
            focusOption(results.length - 1);
        }
    };

    const onEmojiChange = (text: string) => {
        setEmojiText(text);
        const trimmed = text.trim();
        if (!trimmed) {
            setEmojiError(false);
            return;
        }
        const parsed = parseInterestIcon(trimmed);
        if (parsed && parsed.kind === "emoji") {
            setEmojiError(false);
            choose(parsed.glyph);
        } else {
            setEmojiError(true);
        }
    };

    return (
        <div className="space-y-2" data-testid="interest-icon-field">
            <label className="text-xs font-semibold text-strong/90 block" id="interest-icon-label">
                {t("editor.interestIcon")}
            </label>
            <div className="flex items-center gap-2">
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            data-testid="interest-icon-trigger"
                            aria-labelledby="interest-icon-label"
                            aria-haspopup="dialog"
                            aria-expanded={open}
                            title={t("editor.interestIconChoose")}
                            className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-edge bg-surface-1 px-3 py-1.5 text-sm text-strong transition-colors hover:border-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                            {current ? (
                                <span className="inline-flex h-5 w-5 items-center justify-center text-base">
                                    <InterestIconView value={value} />
                                </span>
                            ) : null}
                            <span className={current ? "sr-only" : "text-faint"}>
                                {current ? t("editor.interestIconChoose") : t("editor.interestIconNone")}
                            </span>
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        className="w-[min(22rem,calc(100vw-2rem))] space-y-3"
                        role="dialog"
                        aria-label={t("editor.interestIconChoose")}
                        data-testid="interest-icon-popover"
                        onOpenAutoFocus={(event) => {
                            event.preventDefault();
                            searchRef.current?.focus();
                        }}
                    >
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-faint" aria-hidden="true" />
                            <input
                                ref={searchRef}
                                type="search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === "ArrowDown" && results.length > 0) {
                                        event.preventDefault();
                                        focusOption(0);
                                    }
                                }}
                                aria-label={t("editor.interestIconSearch")}
                                placeholder={t("editor.interestIconSearchPlaceholder")}
                                data-testid="interest-icon-search"
                                className="w-full rounded-lg border border-edge bg-surface-2 py-2 pl-8 pr-2 text-sm text-strong placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            />
                        </div>

                        {results.length === 0 ? (
                            <p className="py-4 text-center text-sm text-faint" data-testid="interest-icon-empty" role="status">
                                {t("editor.interestIconEmpty")}
                            </p>
                        ) : (
                            <div
                                role="listbox"
                                aria-label={t("editor.interestIconChoose")}
                                onKeyDown={onGridKeyDown}
                                data-testid="interest-icon-grid"
                                className="grid max-h-56 gap-1 overflow-y-auto"
                                style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))` }}
                            >
                                {results.map((entry, index) => {
                                    const Icon = entry.icon;
                                    const selected = current?.kind === "lucide" && current.name === entry.name;
                                    return (
                                        <button
                                            key={entry.name}
                                            ref={(node) => { optionRefs.current[index] = node; }}
                                            type="button"
                                            role="option"
                                            aria-selected={selected}
                                            aria-label={entry.label}
                                            title={entry.label}
                                            tabIndex={index === activeIndex ? 0 : -1}
                                            data-testid={`interest-icon-option-${entry.name}`}
                                            onFocus={() => setActiveIndex(index)}
                                            onClick={() => choose(formatLucideIcon(entry.name))}
                                            className={`flex h-9 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                                selected ? "border-accent bg-edge text-strong" : "border-transparent text-mid hover:bg-edge hover:text-strong"
                                            }`}
                                        >
                                            <Icon className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="space-y-1">
                            <label htmlFor="interest-icon-emoji" className="text-xs font-semibold text-strong/90 block">
                                {t("editor.interestIconEmojiLabel")}
                            </label>
                            <input
                                id="interest-icon-emoji"
                                type="text"
                                inputMode="text"
                                value={emojiText}
                                onChange={(event) => onEmojiChange(event.target.value)}
                                placeholder={t("editor.interestIconEmojiPlaceholder")}
                                aria-invalid={emojiError}
                                aria-describedby={emojiError ? "interest-icon-emoji-error" : undefined}
                                data-testid="interest-icon-emoji-input"
                                className="w-full rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm text-strong placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            />
                            {emojiError ? (
                                <p id="interest-icon-emoji-error" role="alert" className="text-xs text-red-500" data-testid="interest-icon-emoji-error">
                                    {t("editor.interestIconEmojiInvalid")}
                                </p>
                            ) : null}
                        </div>
                    </PopoverContent>
                </Popover>

                {current ? (
                    <button
                        type="button"
                        data-testid="interest-icon-clear"
                        onClick={() => onChange(undefined)}
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-sm text-faint transition-colors hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("editor.interestIconClear")}
                    </button>
                ) : null}
            </div>
        </div>
    );
}
