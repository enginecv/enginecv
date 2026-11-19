"use client";

import { FolderSync, Loader2, Pause, Play, Unlink } from "lucide-react";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";
import { analyzeFolderHandle, applyHeldChange, chooseDuplicate, connectFolder, disconnectWorkspace, ignoreFile, keepAppVersion, recreateDocumentFile, relinkDocumentTo, resumePermission, setPaused, useWorkspaceStore } from "@/lib/workspace/controller";
import { pickWorkspaceFolder } from "@/lib/workspace/directory-adapter";
import type { PlanItem } from "@/lib/workspace/first-sync";
import type { SetupAnalysis } from "@/lib/workspace/setup";
import { ConflictsDialog } from "./ConflictsDialog";
import { DocStateChip } from "./DocStateChip";
import { FirstSyncDialog } from "./FirstSyncDialog";
import { ReviewDialog } from "./ReviewDialog";
import { SetupWarning } from "./SetupWarning";

type Step = { kind: "idle" } | { kind: "warning" } | { kind: "review"; handle: FileSystemDirectoryHandle; analysis: SetupAnalysis };

/**
 * The workspace folder panel: connect a folder (warning, pick, review), see its state, pause, resume
 * after the browser asks for permission again, and disconnect. Disconnecting changes nothing on disk.
 */
export function WorkspacePanel({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation();
    const ref = useDialogFocus<HTMLDivElement>(true, onClose);
    const state = useWorkspaceStore();
    const [step, setStep] = useState<Step>({ kind: "idle" });
    const [hideContact, setHideContact] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmDisconnect, setConfirmDisconnect] = useState(false);
    const [reviewing, setReviewing] = useState<string | null>(null);
    const [showConflicts, setShowConflicts] = useState(false);
    const rows = useLiveQuery(() => db.workspaceDocs.toArray(), [], []);
    const titles = useLiveQuery(async () => {
        const map = new Map<string, string>();
        for (const cv of await db.resumes.toArray()) map.set(cv.id ?? "", cv.meta?.title || cv.basics?.name || "CV");
        for (const letter of await db.coverLetters.toArray()) map.set(letter.id, letter.title || [letter.company, letter.role].filter(Boolean).join(" - ") || letter.id);
        return map;
    }, [], new Map<string, string>());
    const titleOf = (docId: string) => titles.get(docId) ?? docId;
    const detached = rows.filter((row) => row.state === "detached" && row.included).map((row) => ({ row, title: titleOf(row.docId) }));
    const attentionCount = detached.length + state.attention.duplicates.length + state.attention.unmatched.length + state.attention.conflictCopies.length;
    const attention = rows.filter((row) => row.included && row.state !== "in-sync" && row.state !== "paused");
    const reviewRow = rows.find((row) => row.docId === reviewing);

    useEffect(() => {
        setError(state.error);
    }, [state.error]);

    const pickAndAnalyze = async () => {
        setError(null);
        try {
            const handle = await pickWorkspaceFolder();
            if (!handle) {
                setStep({ kind: "idle" });
                return;
            }
            setBusy(true);
            const analysis = await analyzeFolderHandle(handle, { hideContact });
            setStep({ kind: "review", handle, analysis });
        } catch {
            setError("workspace.panel.connectFailed");
            setStep({ kind: "idle" });
        } finally {
            setBusy(false);
        }
    };

    const apply = async (plan: PlanItem[]) => {
        if (step.kind !== "review") return;
        setBusy(true);
        try {
            await connectFolder({ handle: step.handle, analysis: { ...step.analysis, plan }, options: { hideContact } });
            setStep({ kind: "idle" });
        } catch {
            setError("workspace.panel.connectFailed");
            setStep({ kind: "idle" });
        } finally {
            setBusy(false);
        }
    };

    const button = "flex items-center gap-2 rounded-xl border border-edge bg-surface-4 px-3 py-2 text-sm font-medium text-strong transition-colors hover:border-faint disabled:opacity-60";
    const primary = "flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-surface-2 transition-colors hover:bg-accent-soft disabled:opacity-60";

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={onClose} />
            <div ref={ref} role="dialog" aria-modal="true" aria-label={t("workspace.title")} data-testid="workspace-panel" className="glass-panel relative w-full max-w-lg rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center gap-2">
                    <FolderSync className="h-5 w-5 text-accent" aria-hidden="true" />
                    <h2 className="text-lg font-bold text-strong">{t("workspace.title")}</h2>
                </div>
                <p className="mt-2 text-sm text-mid">{t("workspace.panel.intro")}</p>

                {error && <p role="alert" className="mt-3 text-sm text-danger" data-testid="workspace-error">{t(error)}</p>}

                <div className="mt-4 space-y-3" data-testid={`workspace-phase-${state.phase}`}>
                    {state.phase === "loading" && <Loader2 className="h-5 w-5 animate-spin text-faint" aria-label={t("dashboard.saving")} />}

                    {state.phase === "unsupported" && <p className="rounded-xl border border-edge bg-surface-1 p-3 text-sm text-mid" data-testid="workspace-unsupported">{t("workspace.panel.unsupported")}</p>}

                    {(state.phase === "none" || state.phase === "connecting") && (
                        <button type="button" disabled={busy || state.phase === "connecting"} onClick={() => setStep({ kind: "warning" })} data-testid="workspace-choose" className={primary}>
                            {(busy || state.phase === "connecting") && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                            {state.phase === "connecting" ? t("workspace.panel.connecting") : t("workspace.panel.choose")}
                        </button>
                    )}

                    {state.phase === "needs-permission" && (
                        <div className="space-y-2">
                            <p className="rounded-xl border border-accent/30 bg-surface-1 p-3 text-sm text-mid" data-testid="workspace-needs-permission">{t("workspace.panel.needsPermission")}</p>
                            <button type="button" onClick={() => void resumePermission()} data-testid="workspace-resume-permission" className={primary}>{t("workspace.panel.resume")}</button>
                        </div>
                    )}

                    {state.phase === "broken" && (
                        <div className="space-y-2">
                            <p className="rounded-xl border border-danger/30 bg-surface-1 p-3 text-sm text-danger" data-testid="workspace-broken">{t("workspace.panel.broken")}</p>
                            <button type="button" onClick={() => setStep({ kind: "warning" })} data-testid="workspace-choose-again" className={primary}>{t("workspace.panel.chooseAgain")}</button>
                        </div>
                    )}

                    {state.phase === "connected" && (
                        <div className="space-y-3">
                            <div className="rounded-xl border border-edge bg-surface-1 p-3 text-sm">
                                <p className="font-medium text-strong" data-testid="workspace-folder-name">{t("workspace.panel.connected", { folder: state.folderName ?? "" })}</p>
                                <p className="text-mid" data-testid="workspace-doc-count">{t("workspace.panel.documents", { count: state.docCount })}</p>
                                <p className="text-xs text-faint">{t(state.changeSource === "observer" ? "workspace.panel.changeSourceObserver" : "workspace.panel.changeSourcePoll")}</p>
                                {state.paused && <p className="text-xs text-accent" data-testid="workspace-paused">{t("workspace.panel.paused")}</p>}
                                {!state.isLeader && <p className="text-xs text-faint" data-testid="workspace-other-tab">{t("workspace.panel.otherTab")}</p>}
                            </div>
                            {attention.length > 0 && (
                                <ul className="space-y-1" data-testid="workspace-doc-list">
                                    {attention.map((row) => (
                                        <li key={row.docId} className="flex items-center justify-between gap-2 rounded-lg border border-edge bg-surface-1 px-3 py-2 text-sm">
                                            <span className="min-w-0 truncate text-strong">{titleOf(row.docId)}</span>
                                            <span className="flex items-center gap-2">
                                                <DocStateChip state={row.state} reason={row.reason} />
                                                {row.state === "review" && row.pendingReview && <button type="button" data-testid={`workspace-review-open-${row.docId}`} onClick={() => setReviewing(row.docId)} className="text-xs font-bold text-accent hover:underline">{t("workspace.state.review")}</button>}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {attentionCount > 0 && <button type="button" onClick={() => setShowConflicts(true)} data-testid="workspace-open-conflicts" className={button}>{t("workspace.panel.attention", { count: attentionCount })}</button>}
                            <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => void setPaused(!state.paused)} data-testid="workspace-pause" className={button}>
                                    {state.paused ? <Play className="h-4 w-4" aria-hidden="true" /> : <Pause className="h-4 w-4" aria-hidden="true" />}
                                    {state.paused ? t("workspace.panel.resume") : t("workspace.panel.pause")}
                                </button>
                                <button type="button" onClick={() => setConfirmDisconnect(true)} data-testid="workspace-disconnect" className={button}>
                                    <Unlink className="h-4 w-4" aria-hidden="true" />
                                    {t("workspace.panel.disconnect")}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-5 flex justify-end">
                    <button type="button" onClick={onClose} data-testid="workspace-close" className="rounded-xl border border-edge bg-surface-4 px-4 py-2 text-sm font-bold text-mid hover:border-faint hover:text-strong">{t("common.close")}</button>
                </div>
            </div>

            {step.kind === "warning" && (
                <SetupWarning
                    hideContact={hideContact}
                    onHideChange={setHideContact}
                    onCancel={() => setStep({ kind: "idle" })}
                    onContinue={() => void pickAndAnalyze()}
                />
            )}
            {step.kind === "review" && <FirstSyncDialog plan={step.analysis.plan} leftOut={step.analysis.skipped.length} busy={busy} onApply={(plan) => void apply(plan)} onCancel={() => setStep({ kind: "idle" })} />}

            {reviewRow?.pendingReview && (
                <ReviewDialog
                    docTitle={titleOf(reviewRow.docId)}
                    review={reviewRow.pendingReview}
                    onClose={() => setReviewing(null)}
                    onApply={() => { setReviewing(null); void applyHeldChange(reviewRow.docId); }}
                    onKeepMine={() => { setReviewing(null); void keepAppVersion(reviewRow.docId); }}
                />
            )}
            {showConflicts && (
                <ConflictsDialog
                    attention={state.attention}
                    detached={detached}
                    onClose={() => setShowConflicts(false)}
                    onKeepFile={(docId, keep, others) => void chooseDuplicate(docId, keep, others)}
                    onRelink={(docId, file) => void relinkDocumentTo(docId, file)}
                    onRecreate={(docId) => void recreateDocumentFile(docId)}
                    onIgnore={(file) => void ignoreFile(file)}
                />
            )}

            <ConfirmModal
                open={confirmDisconnect}
                title={t("workspace.panel.disconnectTitle")}
                description={t("workspace.panel.disconnectBody")}
                confirmLabel={t("workspace.panel.disconnectConfirm")}
                destructive
                onConfirm={() => { setConfirmDisconnect(false); void disconnectWorkspace(); }}
                onCancel={() => setConfirmDisconnect(false)}
            />
        </div>
    );
}
