"use client";

import { Clock3, Copy, RotateCcw } from "lucide-react";
import type { ResumeHistoryEntry } from "@/lib/db";
import { useTranslation } from "@/lib/i18n";

interface HistoryPanelProps {
    entries: ResumeHistoryEntry[];
    selectedEntryId: number | null;
    onSelectEntry: (entryId: number) => void;
    onPreviewCurrent: () => void;
    onRestoreSelected: () => void;
    onDuplicateSelected: () => void;
    canRestoreSelected: boolean;
    canDuplicateSelected: boolean;
}

function getTriggerLabelKey(trigger: ResumeHistoryEntry["trigger"]) {
    switch (trigger) {
        case "json-edit":
            return "history.triggerJsonEdit";
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

export function HistoryPanel({
    entries,
    selectedEntryId,
    onSelectEntry,
    onPreviewCurrent,
    onRestoreSelected,
    onDuplicateSelected,
    canRestoreSelected,
    canDuplicateSelected,
}: HistoryPanelProps) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <button
                    type="button"
                    onClick={onPreviewCurrent}
                    className={`w-full text-left rounded-2xl border px-4 py-3 transition-colors ${selectedEntryId === null
                        ? "border-accent/50 bg-accent/10"
                        : "border-edge bg-surface-1 hover:border-faint"
                        }`}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-sm font-medium text-strong">{t("history.currentDraft")}</div>
                            <div className="text-xs text-faint mt-1">{t("history.currentDraftDesc")}</div>
                        </div>
                        <span className="px-2 py-1 rounded-full bg-edge text-[10px] uppercase tracking-wider text-bright shrink-0">{t("history.live")}</span>
                    </div>
                </button>

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
                            className={`w-full text-left rounded-2xl border px-4 py-3 transition-colors ${selectedEntryId === entry.id
                                ? "border-accent/50 bg-accent/10"
                                : "border-edge bg-surface-1 hover:border-faint"
                                }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 text-sm font-medium text-strong">
                                        <Clock3 className="w-3.5 h-3.5 text-accent shrink-0" />
                                        <span className="truncate">{new Date(entry.createdAt).toLocaleString()}</span>
                                    </div>
                                    <p className="text-xs text-faint mt-1.5">{t(getTriggerLabelKey(entry.trigger))}</p>
                                </div>
                                <span className="px-2 py-1 rounded-full bg-edge text-[10px] uppercase tracking-wider text-bright shrink-0">
                                    {t(getTriggerLabelKey(entry.trigger))}
                                </span>
                            </div>
                        </button>
                    ))
                )}
            </div>

            <div className="border-t border-edge p-4 space-y-2">
                <button
                    type="button"
                    onClick={onRestoreSelected}
                    disabled={!canRestoreSelected}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-accent hover:bg-accent-soft text-surface-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <RotateCcw className="w-4 h-4" />
                    {t("history.restoreSelected")}
                </button>
                <button
                    type="button"
                    onClick={onDuplicateSelected}
                    disabled={!canDuplicateSelected}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-edge text-strong hover:border-faint hover:bg-surface-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Copy className="w-4 h-4" />
                    {t("history.duplicateAsNew")}
                </button>
            </div>
        </div>
    );
}
