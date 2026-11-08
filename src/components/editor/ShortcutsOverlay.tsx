"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { useTranslation } from "@/lib/i18n";
import { useDialogFocus } from "@/hooks/useDialogFocus";

/**
 * A single shortcut line. `keys` is a space-separated spec: every token becomes
 * its own key cap, except "/" which renders as a plain separator between
 * alternatives. "Mod" is substituted for ⌘ on macOS and Ctrl elsewhere; rows
 * whose macOS binding differs by more than that modifier supply `macKeys`.
 */
interface ShortcutRow {
    keys: string;
    macKeys?: string;
    labelKey: string;
}

interface ShortcutGroup {
    titleKey: string;
    rows: ShortcutRow[];
}

const GROUPS: ShortcutGroup[] = [
    {
        titleKey: "shortcuts.group.navigate",
        rows: [
            { keys: "↑ ↓ ← → / h j k l", labelKey: "shortcuts.moveBetweenFields" },
            { keys: "Tab / Shift+Tab", labelKey: "shortcuts.nextPrevField" },
            { keys: "g / G", labelKey: "shortcuts.firstLastField" },
            { keys: "Enter / F2 / i / a", labelKey: "shortcuts.startEditing" },
        ],
    },
    {
        titleKey: "shortcuts.group.edit",
        rows: [
            { keys: "Mod+B / Mod+I / Mod+U", labelKey: "shortcuts.boldItalicUnderline" },
            { keys: "Ctrl+Shift+←→", macKeys: "⌥+Shift+←→", labelKey: "shortcuts.selectByWord" },
            { keys: "Ctrl+Backspace", macKeys: "⌥+Backspace", labelKey: "shortcuts.deleteWord" },
            { keys: "Enter", labelKey: "shortcuts.commitPlain" },
            { keys: "Mod+Enter", labelKey: "shortcuts.commitRich" },
            { keys: "Tab", labelKey: "shortcuts.commitAndNext" },
            { keys: "Esc", labelKey: "shortcuts.cancelEdit" },
        ],
    },
    {
        titleKey: "shortcuts.group.view",
        rows: [
            { keys: "Space", labelKey: "shortcuts.panPage" },
            { keys: "Mod+Scroll", labelKey: "shortcuts.zoomPage" },
            { keys: "f", labelKey: "shortcuts.focusMode" },
            { keys: "Esc", labelKey: "shortcuts.leaveFocusMode" },
        ],
    },
    {
        titleKey: "shortcuts.group.general",
        rows: [
            { keys: "Mod+K", labelKey: "shortcuts.openPalette" },
            { keys: "Mod+Shift+J", labelKey: "jsonEditor.open" },
            { keys: "Mod+S", labelKey: "shortcuts.save" },
            { keys: "Mod+Z", labelKey: "shortcuts.historyBack" },
            { keys: "Mod+Shift+Z / Mod+Y", labelKey: "shortcuts.historyForward" },
            { keys: "Delete / Backspace", labelKey: "shortcuts.deleteDesignElement" },
            { keys: "?", labelKey: "shortcuts.openThisList" },
        ],
    },
];

function detectIsMac() {
    return typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform ?? "");
}

function KeySpec({ spec }: { spec: string }) {
    return (
        <span className="flex shrink-0 flex-wrap items-center gap-1">
            {spec.split(" ").map((token, index) =>
                token === "/" ? (
                    <span key={index} className="px-0.5 text-[10px] text-faint">
                        /
                    </span>
                ) : (
                    <Kbd key={index}>{token}</Kbd>
                ),
            )}
        </span>
    );
}

/**
 * Keyboard shortcut reference for the editor, opened with `?` or from the Help
 * menu. Every binding listed here is implemented somewhere in the editor — keep
 * the two in step when shortcuts change.
 */
export function ShortcutsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { t } = useTranslation();
    // Safe to read during render: the sheet only ever paints after hydration,
    // so this never disagrees with the server-rendered (empty) output.
    const isMac = detectIsMac();

    useEffect(() => {
        if (!open) return;
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onClose();
            }
        };
        // Capture phase so Esc closes this sheet without also leaving focus mode.
        document.addEventListener("keydown", handleKey, true);
        return () => document.removeEventListener("keydown", handleKey, true);
    }, [open, onClose]);

    const dialogRef = useDialogFocus<HTMLDivElement>(open); // Escape is already handled by this dialog.

    if (!open) return null;

    const resolve = (row: ShortcutRow) => {
        const spec = isMac && row.macKeys ? row.macKeys : row.keys;
        return spec.replace(/Mod/g, isMac ? "⌘" : "Ctrl");
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 print:hidden">
            <div
                className="absolute inset-0 bg-surface-2/80 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="shortcuts-overlay-title"
                className="relative glass-panel flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl shadow-2xl animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300"
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={t("shortcuts.close")}
                    className="absolute right-4 top-4 text-faint transition-all duration-200 hover:rotate-90 hover:text-strong"
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="shrink-0 px-8 pt-8">
                    <h2
                        id="shortcuts-overlay-title"
                        className="text-xl font-bold tracking-tight text-strong"
                    >
                        {t("shortcuts.title")}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-mid">{t("shortcuts.subtitle")}</p>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-8 pt-6">
                    <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
                        {GROUPS.map((group) => (
                            <div key={group.titleKey}>
                                <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-dim">
                                    {t(group.titleKey)}
                                </h3>
                                <ul className="mt-3 space-y-2.5">
                                    {group.rows.map((row) => (
                                        <li
                                            key={`${group.titleKey}-${row.labelKey}-${row.keys}`}
                                            className="flex items-start justify-between gap-4"
                                        >
                                            <span className="min-w-0 text-sm leading-6 text-bright">
                                                {t(row.labelKey)}
                                            </span>
                                            <KeySpec spec={resolve(row)} />
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
