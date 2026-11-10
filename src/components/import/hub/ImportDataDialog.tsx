"use client";

import { CheckCircle2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SecretKeyDialog } from "@/components/ui/SecretKeyDialog";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { recordResumeHistory } from "@/lib/history";
import { useTranslation } from "@/lib/i18n";
import type { ImportProvider } from "@/lib/import/provider";
import type { ReadSourceHelpers } from "@/lib/import/read-source";
import { applyMergePlan } from "@/lib/import/staging/apply";
import type { StagedBatch } from "@/lib/import/staging/types";
import type { Resume } from "@/lib/schema";
import { ApplyBar } from "./ApplyBar";
import { ReviewStep } from "./ReviewStep";
import { SourcePicker } from "./SourcePicker";
import { StagedSources } from "./StagedSources";
import { useImportHub, type HubStep } from "./useImportHub";

export interface ImportDataDialogProps {
    /** The CV the result is merged into. On the dashboard, a blank one with target "new". */
    current: Resume;
    /** `current` offers merge, new and replace; `new` always creates a CV. */
    target?: "current" | "new";
    /** Writes the merged or replaced CV to the editor. */
    onApply?: (next: Resume) => void;
    /** Puts the CV back as it was, after Apply. */
    onUndo?: (previous: Resume) => void;
    /** Saves a new CV and returns its id. */
    onCreateNew: (resume: Resume) => Promise<string>;
    /** Called with the id of a CV the hub created. Defaults to opening it in the editor. */
    onOpenCreated?: (id: string) => void;
    onClose: () => void;
    /** Files already in hand, such as one dropped on the dashboard. */
    initialFiles?: File[];
    /** Tests inject a fake GitHub provider. */
    githubProvider?: ImportProvider;
    /** Opens the GitHub panel straight away. */
    initialSource?: "github";
    /**
     * A "Download my data" file holds several CVs. When given, they go here
     * (each becomes its own CV) instead of being combined into one.
     */
    onImportDataExport?: (resumes: Resume[]) => Promise<void>;
}

type Outcome =
    | { kind: "applied"; previous: Resume }
    | { kind: "undone" }
    | { kind: "created"; id: string }
    | { kind: "failed" };

const STEPS: Array<{ id: HubStep; labelKey: string }> = [
    { id: "sources", labelKey: "importHub.step.sources" },
    { id: "review", labelKey: "importHub.step.review" },
    { id: "done", labelKey: "importHub.step.done" },
];

/**
 * Import data: add sources, review what they hold, tick what to keep, apply in
 * one undoable step. Mounted only while open; closing drops everything staged.
 */
export function ImportDataDialog({
    current,
    target = "current",
    onApply,
    onUndo,
    onCreateNew,
    onOpenCreated,
    onClose,
    initialFiles,
    githubProvider,
    initialSource,
    onImportDataExport,
}: ImportDataDialogProps) {
    const { t } = useTranslation();
    const router = useRouter();
    const fixedNew = target === "new";
    const hub = useImportHub(current, fixedNew ? "new" : "merge");
    const [busy, setBusy] = useState(false);
    const [outcome, setOutcome] = useState<Outcome | null>(null);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const [confirmReplace, setConfirmReplace] = useState(false);

    // Key prompt for encrypted files.
    const [keyOpen, setKeyOpen] = useState(false);
    const [keyValue, setKeyValue] = useState("");
    const [keyError, setKeyError] = useState<string | null>(null);
    const keyResolver = useRef<((value: string | null) => void) | null>(null);

    const requestDecryptionKey = useCallback((errorMessage?: string | null) => {
        setKeyValue("");
        setKeyError(errorMessage ?? null);
        setKeyOpen(true);
        return new Promise<string | null>((resolve) => {
            keyResolver.current = resolve;
        });
    }, []);
    const helpers: ReadSourceHelpers = { requestDecryptionKey };
    const settleKey = (value: string | null) => {
        keyResolver.current?.(value);
        keyResolver.current = null;
        setKeyOpen(false);
    };

    const addBatches = (added: StagedBatch[]) => {
        const exported = added.filter((batch) => batch.fromDataExport);
        if (!onImportDataExport || exported.length === 0) {
            hub.addBatches(added);
            return;
        }
        // Several CVs from one file: each is saved as its own CV, nothing is combined.
        hub.addBatches(added.filter((batch) => !batch.fromDataExport));
        setBusy(true);
        onImportDataExport(exported.map((batch) => batch.resume))
            .then(onClose)
            .catch((error: unknown) => {
                console.error("[EngineCV] Importing a data export failed.", error);
                setOutcome({ kind: "failed" });
                hub.setStep("done");
            })
            .finally(() => setBusy(false));
    };

    const hasStaged = hub.batches.length > 0 && hub.step !== "done";
    const requestClose = useCallback(() => {
        if (busy || keyOpen || confirmDiscard || confirmReplace) return;
        if (hasStaged) setConfirmDiscard(true);
        else onClose();
    }, [busy, keyOpen, confirmDiscard, confirmReplace, hasStaged, onClose]);
    const dialogRef = useDialogFocus<HTMLDivElement>(true, requestClose);

    const canReplace = !hub.batches[0]?.fromDataExport;

    const runApply = async () => {
        setBusy(true);
        try {
            const mode = fixedNew ? "new" : hub.mode;
            const next = applyMergePlan(current, hub.plan, hub.selection, mode);
            if (mode === "new") {
                const id = await onCreateNew(next);
                setOutcome({ kind: "created", id });
            } else {
                // A snapshot first, so the previous version is always in the history.
                await recordResumeHistory(current, "manual");
                onApply?.(next);
                setOutcome({ kind: "applied", previous: current });
            }
            hub.setStep("done");
        } catch (error) {
            console.error("[EngineCV] Applying the import failed.", error);
            setOutcome({ kind: "failed" });
            hub.setStep("done");
        } finally {
            setBusy(false);
        }
    };

    const handleApply = () => {
        if (!fixedNew && hub.mode === "replace") setConfirmReplace(true);
        else void runApply();
    };

    const undo = () => {
        if (outcome?.kind !== "applied") return;
        onUndo?.(outcome.previous);
        setOutcome({ kind: "undone" });
    };

    const done = hub.step === "done";
    const currentStepIndex = STEPS.findIndex((step) => step.id === hub.step);

    return (
        <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={requestClose} />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={t("importHub.title")}
                data-testid="import-hub-dialog"
                className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-edge bg-surface-2 shadow-2xl sm:rounded-2xl"
            >
                <header className="flex items-start gap-3 border-b border-edge px-4 py-3 sm:px-6">
                    <div className="min-w-0 flex-1">
                        <h2 className="text-base font-semibold text-strong">{t("importHub.title")}</h2>
                        <ol className="mt-1 flex flex-wrap gap-x-3 text-xs text-faint" aria-label={t("importHub.title")}>
                            {STEPS.map((step, index) => (
                                <li key={step.id} aria-current={step.id === hub.step ? "step" : undefined} className={index === currentStepIndex ? "font-medium text-accent" : ""}>
                                    {index + 1}. {t(step.labelKey)}
                                </li>
                            ))}
                        </ol>
                    </div>
                    <button
                        type="button"
                        onClick={requestClose}
                        aria-label={t("common.close")}
                        data-testid="import-hub-close"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-faint outline-none transition-colors hover:text-strong focus-visible:ring-1 focus-visible:ring-accent"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                </header>

                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
                    {hub.step === "sources" && (
                        <>
                            <p className="text-sm text-faint">{t("importHub.intro")}</p>
                            <SourcePicker onAdd={addBatches} helpers={helpers} initialFiles={initialFiles} githubProvider={githubProvider} initialGithubOpen={initialSource === "github"} />
                            <StagedSources batches={hub.batches} onRemove={hub.removeBatch} />
                            <p className="text-xs text-faint">{t("importHub.privacy")}</p>
                        </>
                    )}

                    {hub.step === "review" && <ReviewStep hub={hub} />}

                    {done && outcome && (
                        <div data-testid="import-hub-done" role="status" className="flex flex-col items-center gap-3 py-8 text-center">
                            <CheckCircle2 className={`h-10 w-10 ${outcome.kind === "failed" ? "text-danger" : "text-accent"}`} aria-hidden="true" />
                            <p className="text-base text-strong">
                                {outcome.kind === "failed" && t("importHub.done.failed")}
                                {outcome.kind === "undone" && t("importHub.done.undone")}
                                {outcome.kind === "created" && t("importHub.done.newTitle")}
                                {outcome.kind === "applied" && t("importHub.done.title")}
                            </p>
                            <div className="flex flex-wrap justify-center gap-2">
                                {outcome.kind === "applied" && onUndo && (
                                    <button
                                        type="button"
                                        onClick={undo}
                                        data-testid="import-hub-undo"
                                        className="min-h-11 rounded-md border border-edge px-4 text-sm text-bright outline-none hover:bg-surface-4 focus-visible:ring-1 focus-visible:ring-accent"
                                    >
                                        {t("importHub.done.undo")}
                                    </button>
                                )}
                                {outcome.kind === "created" && (
                                    <button
                                        type="button"
                                        onClick={() => (onOpenCreated ? onOpenCreated(outcome.id) : router.push(`/editor/${outcome.id}`))}
                                        data-testid="import-hub-open-created"
                                        className="min-h-11 rounded-md bg-accent px-4 text-sm font-medium text-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                    >
                                        {t("importHub.done.open")}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="min-h-11 rounded-md border border-edge px-4 text-sm text-bright outline-none hover:bg-surface-4 focus-visible:ring-1 focus-visible:ring-accent"
                                >
                                    {t("common.close")}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {hub.step === "sources" && (
                    <footer className="flex justify-end border-t border-edge px-4 py-3 sm:px-6">
                        <button
                            type="button"
                            disabled={hub.batches.length === 0}
                            onClick={() => hub.setStep("review")}
                            data-testid="import-hub-review"
                            className="min-h-11 rounded-md bg-accent px-5 text-sm font-medium text-surface-2 outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
                        >
                            {t("importHub.review")}
                        </button>
                    </footer>
                )}

                {hub.step === "review" && (
                    <footer className="space-y-3 border-t border-edge bg-surface-2 px-4 py-3 sm:px-6">
                        <button
                            type="button"
                            onClick={() => hub.setStep("sources")}
                            data-testid="import-hub-add-another"
                            className="min-h-11 rounded-md px-1 text-sm text-accent outline-none hover:underline focus-visible:ring-1 focus-visible:ring-accent"
                        >
                            {t("importHub.back")}: {t("importHub.addAnother")}
                        </button>
                        <ApplyBar hub={hub} fixedNew={fixedNew} canReplace={canReplace} busy={busy} onApply={handleApply} />
                    </footer>
                )}
            </div>

            <ConfirmModal
                open={confirmDiscard}
                title={t("importHub.discard.title")}
                description={t("importHub.discard.desc")}
                confirmLabel={t("importHub.discard.confirm")}
                destructive
                onCancel={() => setConfirmDiscard(false)}
                onConfirm={() => {
                    setConfirmDiscard(false);
                    onClose();
                }}
            />
            <ConfirmModal
                open={confirmReplace}
                title={t("importHub.replace.title")}
                description={t("importHub.replace.desc")}
                confirmLabel={t("importHub.replace.confirm")}
                destructive
                onCancel={() => setConfirmReplace(false)}
                onConfirm={() => {
                    setConfirmReplace(false);
                    void runApply();
                }}
            />
            <SecretKeyDialog
                open={keyOpen}
                title={t("secretKey.unlockTitle")}
                description={t("secretKey.unlockDescription")}
                warning={t("secretKey.unlockWarning")}
                inputLabel={t("secretKey.inputLabel")}
                placeholder={t("secretKey.placeholder")}
                confirmLabel={t("secretKey.confirmLabel")}
                value={keyValue}
                onValueChange={setKeyValue}
                error={keyError}
                confirmDisabled={!keyValue}
                onConfirm={() => settleKey(keyValue)}
                onCancel={() => settleKey(null)}
            />
        </div>
    );
}
