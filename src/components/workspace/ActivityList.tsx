"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, Check, Eye, Info, Undo2, X } from "lucide-react";
import { useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";
import { listActivityPage, undoActivity } from "@/lib/workspace/activity";
import type { ActivityKind } from "@/lib/workspace/types";

const PAGE = 50;

const ICON: Record<ActivityKind, { Icon: typeof Check; tone: string }> = {
    accepted: { Icon: Check, tone: "text-success" },
    refused: { Icon: X, tone: "text-danger" },
    review: { Icon: Eye, tone: "text-accent" },
    info: { Icon: Info, tone: "text-faint" },
};

/**
 * What the workspace accepted, refused and held for review, newest first, a page at a time, with a
 * one-click undo on accepted changes. Reasons are one line from a code; nothing here shows document text.
 */
export function ActivityList({ docId = null, titleOf, onClose }: { docId?: string | null; titleOf: (docId: string) => string; onClose: () => void }) {
    const { t } = useTranslation();
    const ref = useDialogFocus<HTMLDivElement>(true, onClose);
    const [limit, setLimit] = useState(PAGE);
    const [failed, setFailed] = useState<number | null>(null);
    const [busy, setBusy] = useState<number | null>(null);
    const page = useLiveQuery(() => listActivityPage({ limit, docId }), [limit, docId]);

    const undo = async (id: number) => {
        setBusy(id);
        setFailed(null);
        const result = await undoActivity(id).catch(() => ({ ok: false as const }));
        setBusy(null);
        if (!result.ok) setFailed(id);
    };

    return (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={onClose} />
            <div ref={ref} role="dialog" aria-modal="true" aria-label={t("workspace.activity.title")} data-testid="workspace-activity" className="glass-panel relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl p-6 shadow-2xl">
                <h3 className="text-lg font-bold text-strong">{t("workspace.activity.title")}</h3>
                {docId && <p className="mt-1 text-xs text-faint" data-testid="workspace-activity-filter">{t("workspace.activity.only", { name: titleOf(docId) })}</p>}

                <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
                    {page === undefined && <p className="text-sm text-mid" data-testid="workspace-activity-loading">{t("workspace.activity.loading")}</p>}
                    {page && page.rows.length === 0 && <p className="text-sm text-mid" data-testid="workspace-activity-empty">{t("workspace.activity.empty")}</p>}
                    {page && page.rows.length > 0 && (
                        <ul className="space-y-1.5" data-testid="workspace-activity-list">
                            {page.rows.map((row) => {
                                const { Icon, tone } = ICON[row.kind];
                                const canUndo = row.kind === "accepted" && row.restoreId !== null && !row.undone;
                                return (
                                    <li key={row.id} data-testid="workspace-activity-row" data-kind={row.kind} className="rounded-lg border border-edge bg-surface-1 px-3 py-2 text-sm">
                                        <div className="flex items-start gap-2">
                                            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} aria-label={t(`workspace.activity.kind.${row.kind}`)} />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-medium text-strong">{row.docId ? titleOf(row.docId) : t("workspace.activity.workspace")}</p>
                                                <p className="text-xs text-mid">{t(`workspace.reason.${row.reason.code}`)}{row.reason.detail && row.kind !== "refused" ? ` (${row.reason.detail})` : ""}</p>
                                                <p className="text-[11px] text-faint">{new Date(row.at).toLocaleString()}</p>
                                            </div>
                                            {canUndo && (
                                                <button type="button" disabled={busy === row.id} onClick={() => void undo(row.id!)} data-testid={`workspace-activity-undo-${row.id}`} className="flex shrink-0 items-center gap-1 rounded-lg border border-edge bg-surface-4 px-2 py-1 text-xs font-medium text-strong hover:border-faint disabled:opacity-60">
                                                    <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                                                    {t("workspace.activity.undo")}
                                                </button>
                                            )}
                                            {row.kind === "accepted" && row.undone && <span className="shrink-0 text-xs text-faint" data-testid={`workspace-activity-undone-${row.id}`}>{t("workspace.activity.undone")}</span>}
                                        </div>
                                        {failed === row.id && (
                                            <p role="alert" className="mt-1 flex items-center gap-1 text-xs text-danger" data-testid="workspace-activity-undo-failed">
                                                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                                                {t("workspace.activity.undoFailed")}
                                            </p>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {page?.hasMore && (
                        <button type="button" onClick={() => setLimit((value) => value + PAGE)} data-testid="workspace-activity-older" className="mt-3 w-full rounded-lg border border-edge bg-surface-4 px-3 py-2 text-sm font-medium text-strong hover:border-faint">{t("workspace.activity.older")}</button>
                    )}
                </div>

                <div className="mt-4 flex justify-end">
                    <button type="button" onClick={onClose} data-testid="workspace-activity-close" className="rounded-xl border border-edge bg-surface-4 px-4 py-2 text-sm font-bold text-mid hover:border-faint hover:text-strong">{t("common.close")}</button>
                </div>
            </div>
        </div>
    );
}
