"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { useTranslation } from "@/lib/i18n";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import {
    findCommandAction,
    indexCommandActions,
    type CommandAction,
} from "./command-actions";

export type { CommandAction } from "./command-actions";

const DIALOG_WIDTH_CLASS = {
    compact: "max-w-lg",
    standard: "max-w-xl",
    wide: "max-w-3xl",
} as const;

const LIST_HEIGHT_CLASS = {
    dialog: {
        compact: "max-h-[min(18rem,48vh)]",
        standard: "max-h-[min(24rem,60vh)]",
        tall: "max-h-[min(34rem,72vh)]",
    },
    sheet: {
        compact: "max-h-[min(24rem,52dvh)]",
        standard: "max-h-[min(32rem,68dvh)]",
        tall: "max-h-[min(40rem,76dvh)]",
    },
} as const;

function groupActions(actions: CommandAction[]) {
    const groups: { name: string; actions: CommandAction[] }[] = [];
    for (const action of actions) {
        const existing = groups.find((group) => group.name === action.group);
        if (existing) existing.actions.push(action);
        else groups.push({ name: action.group, actions: [action] });
    }
    return groups;
}

function normalizeSearchTerm(value: string): string {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase()
        .trim();
}

function filterCommand(value: string, search: string, keywords: string[] = []): number {
    const query = normalizeSearchTerm(search);
    if (!query) return 1;

    const label = normalizeSearchTerm(keywords[0] || value);
    if (label === query) return 1;
    if (label.startsWith(query)) return 0.95;
    if (label.includes(query)) return 0.9;

    const candidate = normalizeSearchTerm([value, ...keywords].join(" "));
    const queryTerms = query.split(/\s+/);
    return queryTerms.every((term) => candidate.includes(term)) ? 0.7 : 0;
}

function ActionItem({
    action,
    keywords,
    path,
    onSelect,
}: {
    action: CommandAction;
    keywords?: string[];
    path?: string[];
    onSelect: () => void;
}) {
    const Icon = action.icon;
    const TrailingIcon = action.trailingIcon;

    return (
        <CommandItem
            value={`${action.label} ${action.id}`}
            keywords={keywords ?? [action.label, action.group, ...(action.keywords ?? [])]}
            disabled={action.disabled}
            onSelect={onSelect}
            className="gap-2.5 px-2.5 py-2 text-bright data-[selected=true]:text-strong"
        >
            <Icon className="h-4 w-4 shrink-0 text-faint" />
            <span className="min-w-0 flex-1">
                <span className="block truncate">{action.label}</span>
                {path?.length ? (
                    <span className="block truncate text-[11px] text-dim">
                        {path.join(" › ")}
                    </span>
                ) : null}
            </span>
            {action.checked !== undefined && (
                <Check
                    className={`h-3.5 w-3.5 shrink-0 text-accent ${action.checked ? "opacity-100" : "opacity-0"}`}
                    aria-hidden={!action.checked}
                />
            )}
            {action.shortcut && <Kbd className="shrink-0">{action.shortcut}</Kbd>}
            {action.status ? (
                <span className="shrink-0 text-[11px] text-dim">{action.status}</span>
            ) : null}
            {TrailingIcon ? (
                <TrailingIcon className="h-3.5 w-3.5 shrink-0 text-faint" />
            ) : null}
            {action.children?.length ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-dim" />
            ) : null}
        </CommandItem>
    );
}

type PalettePage = {
    kind: "group" | "action";
    id: string;
    label: string;
    placeholder?: string;
};

/**
 * Editor command palette. cmdk owns filtering, arrow-key navigation and the
 * active-item aria wiring; this component owns presentation, the open/close
 * lifecycle and the mapping from `CommandAction` to rendered rows.
 *
 * The body is mounted only while open, so the (large) editor tree pays nothing
 * for it when closed and — because the query lives down there — every open
 * starts from an empty search rather than resurrecting the last one.
 */
export function CommandPalette({
    open,
    onClose,
    actions,
    onRunAction,
    variant = "dialog",
}: {
    open: boolean;
    onClose: () => void;
    actions: CommandAction[];
    onRunAction?: (action: CommandAction) => void;
    variant?: "dialog" | "sheet";
}) {
    if (!open) return null;

    return (
        <PaletteBody
            onClose={onClose}
            actions={actions}
            onRunAction={onRunAction}
            variant={variant}
        />
    );
}

function PaletteBody({
    onClose,
    actions,
    onRunAction,
    variant,
}: {
    onClose: () => void;
    actions: CommandAction[];
    onRunAction?: (action: CommandAction) => void;
    variant: "dialog" | "sheet";
}) {
    const { t } = useTranslation();
    // Escape is handled below (it also steps back through nested pages).
    const dialogRef = useDialogFocus<HTMLDivElement>(true);
    const [query, setQuery] = useState("");
    const [pages, setPages] = useState<PalettePage[]>([]);
    const paletteWidth = useClientPreferencesStore(
        (state) => state.preferences.commandPalette.width,
    );
    const paletteHeight = useClientPreferencesStore(
        (state) => state.preferences.commandPalette.height,
    );
    const currentPage = pages.at(-1);
    const rootGroups = useMemo(() => groupActions(actions), [actions]);
    const currentGroup = currentPage?.kind === "group"
        ? rootGroups.find((group) => group.actions.some((action) => action.id === currentPage.id))
        : undefined;
    const currentPageAction = currentPage?.kind === "action"
        ? findCommandAction(actions, currentPage.id)
        : undefined;
    const browseGroups = useMemo(() => {
        if (currentPage?.kind === "group") {
            return [{ name: "", actions: currentGroup?.actions ?? [] }];
        }
        return groupActions(currentPageAction?.children ?? []);
    }, [currentGroup, currentPage?.kind, currentPageAction]);
    const searchActions = useMemo(() => {
        if (currentPage?.kind === "group") return currentGroup?.actions ?? [];
        if (currentPage?.kind === "action") return currentPageAction?.children ?? [];
        return actions;
    }, [actions, currentGroup, currentPage?.kind, currentPageAction]);
    const globalSearch = !currentPage;
    const searchIndex = useMemo(() => {
        return indexCommandActions(searchActions, { global: globalSearch });
    }, [globalSearch, searchActions]);
    const searching = query.trim().length > 0;
    const currentPageLabel = currentGroup?.name ?? currentPageAction?.label ?? currentPage?.label;
    const currentPlaceholder = currentPageAction?.childrenPlaceholder
        ?? currentPage?.placeholder;

    const goBack = () => {
        if (pages.length === 0) return;
        setPages((current) => current.slice(0, -1));
        setQuery("");
    };

    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            // Capture phase prevents Escape from also changing editor focus mode.
            event.preventDefault();
            event.stopPropagation();
            if (pages.length > 0) {
                setPages((current) => current.slice(0, -1));
                setQuery("");
                return;
            }
            onClose();
        };
        document.addEventListener("keydown", handleKey, true);
        return () => document.removeEventListener("keydown", handleKey, true);
    }, [onClose, pages.length]);

    const select = (action: CommandAction) => {
        if (action.disabled) return;
        if (action.children?.length) {
            setPages((current) => [
                ...current,
                {
                    kind: "action",
                    id: action.id,
                    label: action.label,
                    placeholder: action.childrenPlaceholder,
                },
            ]);
            setQuery("");
            return;
        }
        if (!action.run) return;
        if (action.closeOnRun !== false) onClose();
        onRunAction?.(action);
        action.run();
    };

    const selectRootGroup = (group: { name: string; actions: CommandAction[] }) => {
        const firstAction = group.actions[0];
        if (!firstAction) return;
        setPages((current) => [
            ...current,
            {
                kind: "group",
                id: firstAction.id,
                label: group.name,
            },
        ]);
        setQuery("");
    };

    return (
        <div className={`fixed inset-0 z-[200] flex justify-center print:hidden ${
            variant === "sheet"
                ? "items-start p-0 pt-[env(safe-area-inset-top)]"
                : "items-start p-4 pt-[12vh]"
        }`}>
            <div
                className="absolute inset-0 bg-surface-2/80 backdrop-blur-md animate-in fade-in duration-200"
                onClick={onClose}
            />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={t("palette.title")}
                data-variant={variant}
                data-placement={variant === "sheet" ? "top" : "dialog"}
                data-width={paletteWidth}
                data-height={paletteHeight}
                className={`relative w-full overflow-hidden border border-edge bg-surface-1 shadow-2xl animate-in fade-in duration-200 ${
                    variant === "sheet"
                        ? "max-h-[88dvh] rounded-b-xl border-t-0 slide-in-from-top-4"
                        : `${DIALOG_WIDTH_CLASS[paletteWidth]} rounded-2xl zoom-in-95 slide-in-from-top-2`
                }`}
            >
                {/* cmdk owns filtering, arrow-key navigation and aria wiring. */}
                <Command
                    key={currentPage ? `${currentPage.kind}:${currentPage.id}` : "root"}
                    filter={filterCommand}
                    loop
                >
                    {currentPage ? (
                        <div className="flex h-9 items-center gap-1.5 border-b border-edge px-3 text-xs text-faint">
                            <button
                                type="button"
                                onClick={goBack}
                                className="inline-flex min-w-0 items-center gap-1 rounded px-1 py-0.5 transition-colors hover:bg-surface-4 hover:text-strong focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                            >
                                <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{t("palette.commands")}</span>
                            </button>
                            <ChevronRight className="h-3 w-3 shrink-0 text-dim" />
                            <span className="min-w-0 truncate font-medium text-bright">{currentPageLabel}</span>
                        </div>
                    ) : null}
                    <CommandInput
                        autoFocus
                        value={query}
                        onValueChange={setQuery}
                        onKeyDown={(event) => {
                            if (event.key === "Backspace" && !query && currentPage) {
                                event.preventDefault();
                                goBack();
                            }
                        }}
                        placeholder={currentPlaceholder || t("palette.placeholder")}
                    />
                    <CommandList className={LIST_HEIGHT_CLASS[variant][paletteHeight]}>
                        <CommandEmpty>{t("palette.empty", { query })}</CommandEmpty>
                        {searching ? (
                            <CommandGroup heading={t("palette.commands")}>
                                {searchIndex.map((indexedAction) => (
                                    <ActionItem
                                        key={indexedAction.action.id}
                                        action={indexedAction.action}
                                        keywords={indexedAction.keywords}
                                        path={indexedAction.path}
                                        onSelect={() => select(indexedAction.action)}
                                    />
                                ))}
                            </CommandGroup>
                        ) : !currentPage ? (
                            <CommandGroup heading={t("palette.commands")}>
                                {rootGroups.map((group) => {
                                    const Icon = group.actions[0]?.icon;
                                    return (
                                        <CommandItem
                                            key={group.actions[0]?.id ?? group.name}
                                            value={`group:${group.actions[0]?.id ?? group.name}`}
                                            keywords={[group.name]}
                                            onSelect={() => selectRootGroup(group)}
                                            className="gap-2.5 px-2.5 py-2 text-bright data-[selected=true]:text-strong"
                                        >
                                            {Icon ? <Icon className="h-4 w-4 shrink-0 text-faint" /> : null}
                                            <span className="min-w-0 flex-1 truncate">{group.name}</span>
                                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-dim" />
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        ) : browseGroups.map((group, groupIndex) => (
                            <CommandGroup
                                key={group.name || `page-${groupIndex}`}
                                heading={group.name || undefined}
                            >
                                {group.actions.map((action) => (
                                    <ActionItem
                                        key={action.id}
                                        action={action}
                                        onSelect={() => select(action)}
                                    />
                                ))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>

                <div className={`flex items-center gap-3 border-t border-edge px-3 pt-2 text-[11px] text-faint ${
                    variant === "sheet" ? "pb-[max(0.5rem,env(safe-area-inset-bottom))]" : "pb-2"
                }`}>
                    <span className="flex items-center gap-1">
                        <Kbd>↑</Kbd>
                        <Kbd>↓</Kbd>
                        {t("palette.hintMove")}
                    </span>
                    <span className="flex items-center gap-1">
                        <Kbd>↵</Kbd>
                        {t("palette.hintRun")}
                    </span>
                    <span className="flex items-center gap-1">
                        <Kbd>Esc</Kbd>
                        {t(currentPage ? "palette.hintBack" : "palette.hintClose")}
                    </span>
                </div>
            </div>
        </div>
    );
}
