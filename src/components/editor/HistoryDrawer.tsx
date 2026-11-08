"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Clock3, Copy, RotateCcw, X } from "lucide-react";
import type { ResumeHistoryEntry } from "@/lib/db";
import { useTranslation } from "@/lib/i18n";

interface HistoryDrawerProps {
    open: boolean;
    entries: ResumeHistoryEntry[];
    selectedEntryId: number | null;
    onSelectEntry: (entryId: number) => void;
    onPreviewCurrent: () => void;
    onRestoreSelected: () => void;
    onDuplicateSelected: () => void;
    onClose: () => void;
    canRestoreSelected: boolean;
    canDuplicateSelected: boolean;
}

function getTriggerLabelKey(trigger: ResumeHistoryEntry["trigger"]) {
    switch (trigger) {
        case "restore":
            return "history.triggerRestore";
        case "duplicate":
            return "history.triggerDuplicate";
        case "import":
            return "history.triggerImport";
        case "manual":
            return "history.triggerManual";
        case "autosave":
        default:
            return "history.triggerAutosave";
    }
}

export function HistoryDrawer({
    open,
    entries,
    selectedEntryId,
    onSelectEntry,
    onPreviewCurrent,
    onRestoreSelected,
    onDuplicateSelected,
    onClose,
    canRestoreSelected,
    canDuplicateSelected,
}: HistoryDrawerProps) {
    const { t } = useTranslation();
    useEffect(() => {
        if (!open) {
            return;
        }

        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        const { overflow } = document.body.style;
        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", handleEsc);

        return () => {
            document.body.style.overflow = overflow;
            document.removeEventListener("keydown", handleEsc);
        };
    }, [open, onClose]);

    if (!open || typeof document === "undefined") {
        return null;
    }

    return createPortal(
        <div className="fixed inset-0 z-[240] flex justify-end">
            <div className="absolute inset-0" onClick={onClose} />
            <aside className="relative h-full w-full max-w-md bg-surface-4 border-l border-edge shadow-2xl flex flex-col">
                <div className="flex items-center justify-between px-6 py-5 border-b border-edge">
                    <div>
                        <h2 className="text-lg font-semibold text-strong">{t("history.title")}</h2>
                        <p className="text-xs text-faint mt-1">{t("history.subtitle")}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 rounded-xl border border-edge text-faint hover:text-strong hover:border-faint transition-colors flex items-center justify-center"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    <button
                        type="button"
                        onClick={onPreviewCurrent}
                        className={`w-full text-left rounded-2xl border px-4 py-4 transition-colors ${selectedEntryId === null
                            ? "border-accent/50 bg-accent/10"
                            : "border-edge bg-surface-1 hover:border-faint"
                            }`}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <div className="text-sm font-medium text-strong">{t("history.currentDraft")}</div>
                                <div className="text-xs text-faint mt-1">{t("history.currentDraftDesc")}</div>
                            </div>
                            <span className="px-2 py-1 rounded-full bg-edge text-[10px] uppercase tracking-wider text-bright">{t("history.live")}</span>
                        </div>
                    </button>

                    <div className="space-y-3">
                        {entries.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-edge bg-surface-1 px-4 py-8 text-center">
                                <p className="text-sm text-strong">{t("history.noHistory")}</p>
                                <p className="text-xs text-faint mt-2">{t("history.noHistoryDesc")}</p>
                            </div>
                        ) : (
                            entries.map((entry) => (
                                <button
                                    key={entry.id}
                                    type="button"
                                    onClick={() => entry.id && onSelectEntry(entry.id)}
                                    className={`w-full text-left rounded-2xl border px-4 py-4 transition-colors ${selectedEntryId === entry.id
                                        ? "border-accent/50 bg-accent/10"
                                        : "border-edge bg-surface-1 hover:border-faint"
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 text-sm font-medium text-strong">
                                                <Clock3 className="w-4 h-4 text-accent shrink-0" />
                                                <span>{new Date(entry.createdAt).toLocaleString()}</span>
                                            </div>
                                            <p className="text-xs text-faint mt-2">{t(getTriggerLabelKey(entry.trigger))}</p>
                                        </div>
                                        <span className="px-2 py-1 rounded-full bg-edge text-[10px] uppercase tracking-wider text-bright">
                                            {t(getTriggerLabelKey(entry.trigger))}
                                        </span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="border-t border-edge p-5 space-y-3">
                    <button
                        type="button"
                        onClick={onRestoreSelected}
                        disabled={!canRestoreSelected}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium bg-accent hover:bg-accent-soft text-surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RotateCcw className="w-4 h-4" />
                        {t("history.restoreSelected")}
                    </button>
                    <button
                        type="button"
                        onClick={onDuplicateSelected}
                        disabled={!canDuplicateSelected}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border border-edge text-strong hover:border-faint hover:bg-surface-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Copy className="w-4 h-4" />
                        {t("history.duplicateAsNew")}
                    </button>
                </div>
            </aside>
        </div>,
        document.body
    );
}
