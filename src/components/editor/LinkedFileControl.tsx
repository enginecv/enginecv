"use client";

import { FileCheck2, FileWarning, Link2, Loader2, PauseCircle } from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";
import { getActiveEngine, grantAndAttach } from "@/lib/linked-file/controller";
import { isLinkingSupported } from "@/lib/linked-file/fs-access";
import { linkFile, relinkFile, unlinkFile, type ExistingChoice, type LinkResult } from "@/lib/linked-file/link-actions";
import { OPEN_LINKED_FILE_PANEL_EVENT, type LinkErrorCode } from "@/lib/linked-file/types";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import { useResumeStore } from "@/lib/store";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AgentHelp } from "./AgentHelp";

const ERROR_KEYS: Record<LinkErrorCode, string> = {
    empty: "linkedFile.error.empty",
    "too-large": "linkedFile.error.tooLarge",
    "no-document": "linkedFile.error.noDocument",
    "invalid-json": "linkedFile.error.invalidJson",
    "full-export": "linkedFile.error.fullExport",
    "newer-version": "linkedFile.error.newerVersion",
};

const UPDATE_VISIBLE_MS = 10_000;

type Dialog = { kind: "privacy"; resolve: (ok: boolean) => void } | { kind: "existing"; resolve: (choice: ExistingChoice | null) => void } | null;

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
    const ref = useDialogFocus<HTMLDivElement>(true, onClose);
    // Portaled to the body: the header is its own stacking context, and the editor panels
    // below it would otherwise paint over the dialog.
    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={onClose} />
            <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="glass-panel relative w-full max-w-md rounded-2xl p-6 shadow-2xl">
                <h2 className="text-lg font-bold leading-tight text-strong">{title}</h2>
                {children}
            </div>
        </div>,
        document.body,
    );
}

const primaryButton = "rounded-xl bg-accent px-4 py-2 text-sm font-bold text-surface-2 transition-colors hover:bg-accent-soft";
const secondaryButton = "rounded-xl border border-edge bg-surface-4 px-4 py-2 text-sm font-bold text-mid transition-colors hover:border-faint hover:text-strong";
const smallButton = "flex h-8 items-center gap-1.5 rounded-lg border border-edge px-2.5 text-xs text-mid transition-colors hover:bg-surface-4 hover:text-strong";

export function LinkedFileControl({ resumeId }: { resumeId: string }) {
    const { t } = useTranslation();
    const linked = useResumeStore((state) => state.linkedFile);
    const checkboxId = useId();
    const [open, setOpen] = useState(false);
    const [dialog, setDialog] = useState<Dialog>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [dismissedAt, setDismissedAt] = useState<number | null>(null);
    const [helpOpen, setHelpOpen] = useState(false);
    const [dontShow, setDontShow] = useState(false);
    const supported = typeof window !== "undefined" && isLinkingSupported();
    const status = supported || linked.status !== "none" ? linked.status : "unsupported";

    // The update message is non-blocking: it shows for a few seconds, then leaves the screen.
    // The getting-started checklist asks for this panel to open.
    useEffect(() => {
        const openPanel = () => setOpen(true);
        window.addEventListener(OPEN_LINKED_FILE_PANEL_EVENT, openPanel);
        return () => window.removeEventListener(OPEN_LINKED_FILE_PANEL_EVENT, openPanel);
    }, []);

    const updateAt = linked.lastUpdate?.at ?? null;
    useEffect(() => {
        if (updateAt === null) return;
        const timer = setTimeout(() => setDismissedAt(updateAt), UPDATE_VISIBLE_MS);
        return () => clearTimeout(timer);
    }, [updateAt]);
    const showUpdate = updateAt !== null && dismissedAt !== updateAt;

    const confirmPrivacy = useCallback(() => {
        const store = useClientPreferencesStore.getState();
        if (store.preferences.editor.linkedFilePrivacyAcknowledged) return Promise.resolve(true);
        return new Promise<boolean>((resolve) => setDialog({ kind: "privacy", resolve }));
    }, []);

    const confirmExisting = useCallback(
        () => new Promise<ExistingChoice | null>((resolve) => setDialog({ kind: "existing", resolve })),
        [],
    );

    const closeDialog = (value: boolean | ExistingChoice | null) => {
        const current = dialog;
        setDialog(null);
        if (!current) return;
        if (current.kind === "privacy") {
            if (value === true && dontShow) {
                useClientPreferencesStore.getState().updateSection("editor", { linkedFilePrivacyAcknowledged: true });
            }
            current.resolve(value === true);
        } else {
            current.resolve(value === "load" || value === "overwrite" ? value : null);
        }
    };

    const describe = (result: LinkResult) => {
        if (result.ok) {
            setMessage(null);
            return;
        }
        if (result.reason === "cancelled") return;
        setMessage(result.reason === "linked-elsewhere"
            ? t("linkedFile.error.linkedElsewhere", { name: result.ownerTitle })
            : t("linkedFile.error.linkFailed"));
    };

    const run = async (mode: "createNew" | "useExisting", relink = false) => {
        setMessage(null);
        const options = { confirmPrivacy, confirmExisting };
        describe(await (relink ? relinkFile(resumeId, mode, options) : linkFile(resumeId, mode, options)));
    };

    const engine = () => getActiveEngine(resumeId);

    const timeLabel = linked.lastSyncedAt
        ? new Date(linked.lastSyncedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : "";

    const statusLabel = (() => {
        switch (status) {
            case "in-sync": return timeLabel ? t("linkedFile.status.inSync", { time: timeLabel }) : t("linkedFile.status.inSyncNow");
            case "paused": return t("linkedFile.status.paused");
            case "busy": return t("linkedFile.status.busy");
            case "broken": return t("linkedFile.status.broken");
            case "needs-permission": return t("linkedFile.status.needsPermission");
            case "error": return t("linkedFile.status.error");
            case "unsupported": return t("linkedFile.unsupported");
            default: return "";
        }
    })();

    const errorText = linked.error
        ? [
            t(ERROR_KEYS[linked.error.code]),
            linked.error.line ? t("linkedFile.error.position", { line: linked.error.line, column: linked.error.column ?? 1 }) : "",
            t("linkedFile.error.fixHint"),
        ].filter(Boolean).join(" ")
        : "";

    const update = linked.lastUpdate;
    const updateText = update
        ? (update.added + update.removed + update.changed > 0
            ? t("linkedFile.updated", { added: update.added, removed: update.removed, changed: update.changed })
            : t("linkedFile.updatedNoChange"))
        : "";

    const divergenceText = linked.divergence
        ? t(linked.divergence.fileChanged && linked.divergence.cvChanged
            ? "linkedFile.paused.bothChanged"
            : linked.divergence.fileChanged ? "linkedFile.paused.fileChanged" : "linkedFile.paused.cvChanged")
        : "";

    const Icon = status === "in-sync" ? FileCheck2
        : status === "busy" ? Loader2
        : status === "paused" ? PauseCircle
        : status === "error" || status === "broken" || status === "needs-permission" ? FileWarning
        : Link2;

    const triggerLabel = status === "none" || status === "unsupported" ? t("linkedFile.link") : (linked.fileName ?? t("linkedFile.title"));

    return (
        <div className="flex min-w-0 items-center gap-2" data-testid="linked-file-control">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        data-testid="linked-file-trigger"
                        title={statusLabel || triggerLabel}
                        className="flex h-8 min-w-0 max-w-[14rem] items-center gap-1.5 rounded-lg border border-edge bg-surface-1 px-2 text-xs text-mid transition-colors hover:border-faint hover:text-strong"
                    >
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${status === "busy" ? "animate-spin" : ""} ${status === "in-sync" ? "text-success" : status === "error" || status === "broken" ? "text-danger" : ""}`} aria-hidden="true" />
                        <span className="truncate">{triggerLabel}</span>
                    </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[min(92vw,24rem)] space-y-3" data-testid="linked-file-panel">
                    <h2 className="text-sm font-medium text-strong">{t("linkedFile.title")}</h2>

                    {status === "unsupported" && (
                        <p className="text-xs leading-relaxed text-mid" data-testid="linked-file-unsupported">{t("linkedFile.unsupported")}</p>
                    )}

                    {status === "none" && (
                        <>
                            <p className="text-xs leading-relaxed text-mid">{t("linkedFile.linkHint")}</p>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" className={smallButton} onClick={() => void run("createNew")} data-testid="linked-file-create">{t("linkedFile.createNew")}</button>
                                <button type="button" className={smallButton} onClick={() => void run("useExisting")} data-testid="linked-file-existing">{t("linkedFile.useExisting")}</button>
                            </div>
                        </>
                    )}

                    {linked.fileName && status !== "none" && status !== "unsupported" && (
                        <div>
                            <p className="break-all text-sm text-strong" data-testid="linked-file-name">{linked.fileName}</p>
                            <p className="text-xs text-faint" data-testid="linked-file-status">{statusLabel}</p>
                        </div>
                    )}

                    {status === "needs-permission" && (
                        <div className="flex flex-wrap gap-2">
                            <button type="button" className={smallButton} onClick={() => void grantAndAttach(resumeId)} data-testid="linked-file-grant">{t("linkedFile.resumeSyncing")}</button>
                            <button type="button" className={smallButton} onClick={() => void unlinkFile(resumeId)} data-testid="linked-file-unlink">{t("linkedFile.unlink")}</button>
                        </div>
                    )}

                    {(status === "in-sync" || status === "busy") && (
                        <div className="flex flex-wrap gap-2">
                            <button type="button" className={smallButton} onClick={() => void engine()?.pause()} data-testid="linked-file-pause">{t("linkedFile.pause")}</button>
                            <button type="button" className={smallButton} onClick={() => void engine()?.checkNow()} data-testid="linked-file-check">{t("linkedFile.checkNow")}</button>
                            <button type="button" className={smallButton} onClick={() => void unlinkFile(resumeId)} data-testid="linked-file-unlink">{t("linkedFile.unlink")}</button>
                        </div>
                    )}

                    {status === "busy" && <p className="text-xs text-mid">{t("linkedFile.error.busy")}</p>}

                    {status === "paused" && (
                        <div className="space-y-2">
                            {divergenceText && <p className="text-xs text-mid" data-testid="linked-file-divergence">{divergenceText}</p>}
                            <div className="flex flex-wrap gap-2">
                                {linked.divergence ? (
                                    <>
                                        <button type="button" className={smallButton} onClick={() => void engine()?.resolveDivergence("file")} data-testid="linked-file-use-file">{t("linkedFile.paused.useFile")}</button>
                                        <button type="button" className={smallButton} onClick={() => void engine()?.resolveDivergence("cv")} data-testid="linked-file-keep-cv">{t("linkedFile.paused.keepCv")}</button>
                                    </>
                                ) : (
                                    <button type="button" className={smallButton} onClick={() => void engine()?.resume()} data-testid="linked-file-resume">{t("linkedFile.resume")}</button>
                                )}
                                <button type="button" className={smallButton} onClick={() => void unlinkFile(resumeId)} data-testid="linked-file-unlink">{t("linkedFile.unlink")}</button>
                            </div>
                        </div>
                    )}

                    {status === "error" && (
                        <div className="space-y-2">
                            <p className="text-xs leading-relaxed text-danger" role="alert" data-testid="linked-file-error">{errorText}</p>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" className={smallButton} onClick={() => void engine()?.checkNow()} data-testid="linked-file-check">{t("linkedFile.checkNow")}</button>
                                <button type="button" className={smallButton} onClick={() => void unlinkFile(resumeId)} data-testid="linked-file-unlink">{t("linkedFile.unlink")}</button>
                            </div>
                        </div>
                    )}

                    {status === "broken" && (
                        <div className="space-y-2">
                            <p className="text-xs text-mid">{t("linkedFile.status.broken")}</p>
                            <div className="flex flex-wrap gap-2">
                                <button type="button" className={smallButton} onClick={() => void run("useExisting", true)} data-testid="linked-file-relink">{t("linkedFile.relink")}</button>
                                <button type="button" className={smallButton} onClick={() => void unlinkFile(resumeId)} data-testid="linked-file-unlink">{t("linkedFile.unlink")}</button>
                            </div>
                        </div>
                    )}

                    {update && (
                        <div className="text-xs text-mid" data-testid="linked-file-update-detail">
                            <p>{updateText}</p>
                            {update.notices.length > 0 && (
                                <details className="mt-1">
                                    <summary className="cursor-pointer text-accent">{t("linkedFile.notices", { count: update.notices.length })}</summary>
                                    <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto">
                                        {update.notices.map((notice, index) => (
                                            <li key={`${notice.code}-${notice.path}-${index}`} className="break-words">{t(`authoring.notice.${notice.code}`, notice.params)}</li>
                                        ))}
                                    </ul>
                                </details>
                            )}
                        </div>
                    )}

                    {message && <p className="text-xs text-danger" role="alert" data-testid="linked-file-message">{message}</p>}

                    {status !== "none" && status !== "unsupported" && linked.fileName && (
                        <div className="space-y-1 border-t border-edge pt-2 text-[11px] leading-relaxed text-faint">
                            <p>{t("linkedFile.locationHint")}</p>
                            <p>{t("linkedFile.backupNote")}</p>
                            <p>{t("linkedFile.nameFollowsFile")}</p>
                        </div>
                    )}

                    <div className="space-y-1.5 border-t border-edge pt-2">
                        <a href="/linked-files" target="_blank" rel="noopener" className="block text-xs text-accent underline-offset-2 hover:underline" data-testid="linked-file-how-it-works">
                            {t("linkedFile.howItWorks")}
                        </a>
                        <button
                            type="button"
                            onClick={() => setHelpOpen((value) => !value)}
                            aria-expanded={helpOpen}
                            className="text-xs text-accent underline-offset-2 hover:underline"
                            data-testid="linked-file-agent-help-toggle"
                        >
                            {t("linkedFile.agentHelp")}
                        </button>
                        {helpOpen && <div className="mt-2"><AgentHelp filePath={linked.fileName ?? undefined} /></div>}
                    </div>
                </PopoverContent>
            </Popover>

            {showUpdate && updateText && (
                <p className="hidden min-w-0 truncate text-[11px] text-info sm:block" data-testid="linked-file-update">{updateText}</p>
            )}

            <p role="status" aria-live="polite" className="sr-only" data-testid="linked-file-live">
                {[statusLabel, showUpdate ? updateText : ""].filter(Boolean).join(". ")}
            </p>

            {dialog?.kind === "privacy" && (
                <Modal title={t("linkedFile.privacy.title")} onClose={() => closeDialog(false)}>
                    <p className="mt-3 text-sm leading-relaxed text-mid">{t("linkedFile.privacy.body")}</p>
                    <label htmlFor={checkboxId} className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-mid">
                        <input id={checkboxId} type="checkbox" checked={dontShow} onChange={(event) => setDontShow(event.target.checked)} className="h-3.5 w-3.5 accent-accent" data-testid="linked-file-privacy-dont-show" />
                        {t("linkedFile.privacy.dontShow")}
                    </label>
                    <div className="mt-5 flex justify-end gap-2">
                        <button type="button" className={secondaryButton} onClick={() => closeDialog(false)} data-testid="linked-file-privacy-cancel">{t("linkedFile.cancel")}</button>
                        <button type="button" className={primaryButton} onClick={() => closeDialog(true)} data-testid="linked-file-privacy-continue">{t("linkedFile.privacy.continue")}</button>
                    </div>
                </Modal>
            )}

            {dialog?.kind === "existing" && (
                <Modal title={t("linkedFile.existing.title")} onClose={() => closeDialog(null)}>
                    <p className="mt-3 text-sm leading-relaxed text-mid">{t("linkedFile.existing.body")}</p>
                    <div className="mt-5 flex flex-wrap justify-end gap-2">
                        <button type="button" className={secondaryButton} onClick={() => closeDialog(null)}>{t("linkedFile.cancel")}</button>
                        <button type="button" className={secondaryButton} onClick={() => closeDialog("overwrite")} data-testid="linked-file-overwrite">{t("linkedFile.existing.overwrite")}</button>
                        <button type="button" className={primaryButton} onClick={() => closeDialog("load")} data-testid="linked-file-load">{t("linkedFile.existing.load")}</button>
                    </div>
                </Modal>
            )}
        </div>
    );
}
