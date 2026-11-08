"use client";

import { Download, Radiation, X } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { isConfirmWord } from "@/lib/storage-registry/confirm";
import { collectInventory, type Inventory } from "@/lib/storage-registry/inventory";
import { useStorageMessages } from "@/lib/storage-registry/messages";
import { wipeAllData, type DeletionResult, type WipeStep } from "@/lib/storage-registry/wipe";
import { DeletionResultView } from "./DeletionResultView";
import { HoldToConfirmButton } from "./HoldToConfirmButton";
import { useDataDownload } from "./useDataDownload";
import { summaryParts } from "./summary";

const STEPS: WipeStep[] = ["stopping", "database", "storage", "cookies", "server", "verifying"];

type Phase =
    | { kind: "confirming" }
    | { kind: "wiping"; step: WipeStep }
    | { kind: "done"; result: DeletionResult };

/** "Delete all my data": counts, a backup first, a typed word or a hold, then the result. */
export function DeleteAllDataDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { ts } = useStorageMessages();
    const { state: downloadState, download } = useDataDownload(ts);
    const [inventory, setInventory] = useState<Inventory | null>(null);
    const [typed, setTyped] = useState("");
    const [phase, setPhase] = useState<Phase>({ kind: "confirming" });
    const wiping = phase.kind === "wiping";
    // Escape must not close it halfway through, and after deletion only Continue makes sense.
    const dialogRef = useDialogFocus<HTMLDivElement>(open, phase.kind === "confirming" ? onClose : undefined);
    const inputId = useId();
    const titleId = useId();

    // Callers mount the dialog only while it is open, so typed text and phase start fresh each time.
    useEffect(() => {
        if (!open) return;
        collectInventory().then(setInventory).catch(() => setInventory(null));
    }, [open]);

    const run = useCallback(async () => {
        setPhase({ kind: "wiping", step: "stopping" });
        const result = await wipeAllData({ onStep: (step) => setPhase({ kind: "wiping", step }) });
        setPhase({ kind: "done", result });
    }, []);

    if (!open) return null;

    const word = ts("yourData.delete.confirmWord");
    const confirmed = isConfirmWord(typed, word);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={phase.kind === "confirming" ? onClose : undefined} />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="glass-panel relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-2xl sm:p-8"
                data-testid="delete-all-data-dialog"
            >
                {phase.kind === "confirming" && (
                    <button type="button" onClick={onClose} aria-label={ts("yourData.delete.cancel")} className="absolute right-4 top-4 text-faint hover:text-strong">
                        <X className="h-5 w-5" aria-hidden />
                    </button>
                )}

                <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-danger/30 bg-danger-tint text-danger-soft">
                        <Radiation className="h-6 w-6" aria-hidden />
                    </span>
                    <h2 id={titleId} className="text-xl font-bold tracking-tight text-strong">{ts("yourData.delete.dialogTitle")}</h2>
                </div>

                {phase.kind === "confirming" && (
                    <div className="space-y-5">
                        <div className="space-y-2 text-sm">
                            <p className="text-bright">{ts("yourData.delete.willRemove")}</p>
                            <ul className="flex flex-wrap gap-2" data-testid="delete-counts">
                                {inventory
                                    ? summaryParts(inventory, ts).map((part) => (
                                        <li key={part} className="rounded-full border border-edge bg-surface-1 px-3 py-1 text-strong">{part}</li>
                                    ))
                                    : <li className="text-faint">{ts("yourData.reading")}</li>}
                            </ul>
                        </div>

                        <div className="space-y-1">
                            <button
                                type="button"
                                onClick={() => void download()}
                                disabled={downloadState.status === "preparing"}
                                className="inline-flex items-center gap-2 rounded-xl border border-edge bg-surface-1 px-4 py-2 text-sm font-medium text-strong hover:border-faint disabled:opacity-50"
                            >
                                <Download className="h-4 w-4" aria-hidden />
                                {downloadState.status === "preparing" ? ts("yourData.download.preparing") : ts("yourData.delete.downloadFirst")}
                            </button>
                            <p aria-live="polite" className="text-xs">
                                {downloadState.status === "done" && <span className="text-success">{ts("yourData.download.done", { file: downloadState.file })}</span>}
                                {downloadState.status === "failed" && <span className="text-danger">{ts("yourData.download.failed", { reason: downloadState.reason })}</span>}
                            </p>
                        </div>

                        <p className="rounded-xl border border-danger/30 bg-danger-tint p-3 text-sm leading-6 text-danger-soft" role="note">
                            {ts("yourData.delete.warning")}
                        </p>

                        <div className="space-y-2">
                            <label htmlFor={inputId} className="block text-sm font-medium text-strong">
                                {ts("yourData.delete.typeToConfirm", { word })}
                            </label>
                            <input
                                id={inputId}
                                value={typed}
                                onChange={(event) => setTyped(event.target.value)}
                                autoComplete="off"
                                autoCapitalize="characters"
                                spellCheck={false}
                                className="w-full rounded-xl border border-edge bg-surface-4 px-4 py-3 text-sm text-strong focus:border-faint focus:outline-none"
                            />
                            <p className="text-xs text-faint">{ts("yourData.delete.orHold")}</p>
                            <HoldToConfirmButton
                                label={ts("yourData.delete.hold")}
                                holdingLabel={(seconds) => ts("yourData.delete.holding", { seconds })}
                                onConfirm={() => void run()}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                data-autofocus
                                className="rounded-xl border border-edge bg-surface-4 px-5 py-3 text-sm font-bold text-mid hover:border-faint hover:text-strong"
                            >
                                {ts("yourData.delete.cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={() => void run()}
                                disabled={!confirmed}
                                className="rounded-xl bg-danger px-5 py-3 text-sm font-bold text-surface-1 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {ts("yourData.delete.confirm")}
                            </button>
                        </div>
                    </div>
                )}

                {wiping && (
                    <ol className="space-y-2 text-sm" aria-live="polite" data-testid="wipe-steps">
                        {STEPS.map((step) => {
                            const index = STEPS.indexOf(step);
                            const current = STEPS.indexOf(phase.step);
                            const state = index < current ? "done" : index === current ? "current" : "pending";
                            return (
                                <li key={step} className={state === "pending" ? "text-faint" : state === "current" ? "font-semibold text-strong" : "text-mid"}>
                                    {state === "done" ? "✓ " : state === "current" ? "… " : ""}{ts(`yourData.delete.step.${step}`)}
                                </li>
                            );
                        })}
                    </ol>
                )}

                {phase.kind === "done" && <DeletionResultView result={phase.result} ts={ts} onRetry={() => void run()} />}
            </div>
        </div>
    );
}

export default DeleteAllDataDialog;
