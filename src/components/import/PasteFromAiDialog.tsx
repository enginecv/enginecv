"use client";

import { ClipboardCopy, ClipboardPaste, ExternalLink, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import {
    AUTHORING_SCHEMA_URL,
    authoringToResume,
    buildAiInstructions,
    parseAuthoringText,
    MAX_AUTHORING_TEXT_BYTES,
} from "@/lib/agent/authoring";
import { copyTextToClipboard } from "@/lib/export-clipboard";
import { useTranslation } from "@/lib/i18n";
import { persistImportedResume } from "@/lib/import/persist-imported-resume";
import type { Resume } from "@/lib/schema";
import { AuthoringImportSummary } from "./AuthoringImportSummary";

const PARSE_DEBOUNCE_MS = 200;

export interface PasteFromAiDialogProps {
    open: boolean;
    onClose: () => void;
    /** Pre-filled text, e.g. a dropped `.enginecv.json` file: parsed at once, no debounce. */
    initialText?: string;
    /** A full EngineCV export pasted here goes to the existing JSON import. */
    onFullExport?: (text: string) => void;
    persistResume?: (resume: Resume) => Promise<string>;
    onImported?: (id: string) => void;
}

function analyse(text: string) {
    const parsed = parseAuthoringText(text);
    const converted = parsed.status === "ok" ? authoringToResume(parsed.document) : null;
    return { parsed, converted };
}

/**
 * Paste from AI (#80): paste an assistant's answer, see exactly what will be
 * imported and every value that was repaired or adjusted, then create a new
 * CV. Everything runs in the browser; nothing is saved before Create CV.
 */
export default function PasteFromAiDialog({
    open,
    onClose,
    initialText = "",
    onFullExport,
    persistResume = persistImportedResume,
    onImported,
}: PasteFromAiDialogProps) {
    const { t } = useTranslation();
    const router = useRouter();
    const inputId = useId();
    const [text, setText] = useState(initialText);
    const [analysedText, setAnalysedText] = useState(initialText);
    const [saving, setSaving] = useState(false);
    const [saveFailed, setSaveFailed] = useState(false);
    const [copyState, setCopyState] = useState<"idle" | "copied" | "denied">("idle");
    const fallbackRef = useRef<HTMLTextAreaElement>(null);
    const instructions = useMemo(() => buildAiInstructions(t), [t]);

    const copyInstructions = useCallback(async () => {
        try {
            await copyTextToClipboard(instructions);
            setCopyState("copied");
        } catch {
            // Denied, or no clipboard at all: show the text, selected, to copy by hand.
            setCopyState("denied");
        }
    }, [instructions]);

    useEffect(() => {
        if (copyState === "denied") fallbackRef.current?.select();
    }, [copyState]);

    useEffect(() => {
        if (text === analysedText) return;
        const timer = window.setTimeout(() => setAnalysedText(text), PARSE_DEBOUNCE_MS);
        return () => window.clearTimeout(timer);
    }, [text, analysedText]);

    const { parsed, converted } = useMemo(() => analyse(analysedText), [analysedText]);
    const stale = text !== analysedText;

    const close = useCallback(() => {
        if (saving) return;
        onClose();
    }, [saving, onClose]);

    const dialogRef = useDialogFocus<HTMLDivElement>(open, close);

    const handleImport = useCallback(async () => {
        if (!converted || saving) return;
        setSaving(true);
        setSaveFailed(false);
        try {
            const id = await persistResume(converted.resume);
            onImported?.(id);
            setSaving(false);
            onClose();
            router.push(`/editor/${id}`);
        } catch (error) {
            console.error("[EngineCV] Saving a pasted CV failed.", error);
            setSaving(false);
            setSaveFailed(true);
        }
    }, [converted, onClose, onImported, persistResume, router, saving]);

    if (!open) return null;

    const error = parsed.error;
    const blockedMessage = !text.trim() || !error || error.code === "empty"
        ? null
        : error.code === "too-large"
            ? t("authoring.blocked.tooLarge")
            : error.code === "no-document"
                ? t("authoring.blocked.noDocument")
                : t("authoring.blocked.invalidJson", { line: error.line ?? 1, column: error.column ?? 1 });

    return (
        <div
            className="fixed inset-0 z-[220] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-4"
            onClick={(event) => {
                if (event.target === event.currentTarget) close();
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="paste-from-ai-title"
                data-testid="paste-from-ai-dialog"
                className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-y-auto rounded-[1rem] border border-edge bg-surface-4 p-5 shadow-2xl sm:p-7"
            >
                <button
                    type="button"
                    onClick={close}
                    disabled={saving}
                    className="absolute right-4 top-4 text-faint transition-colors hover:text-strong disabled:opacity-40"
                    aria-label={t("authoring.close")}
                >
                    <X className="h-5 w-5" />
                </button>

                <div className="mb-5 flex items-start gap-3 pr-8">
                    <div className="rounded-xl bg-edge p-2.5">
                        <ClipboardPaste className="h-5 w-5 text-accent" />
                    </div>
                    <div className="min-w-0">
                        <h2 id="paste-from-ai-title" className="text-xl font-semibold text-strong">
                            {t("authoring.title")}
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-dim">{t("authoring.subtitle")}</p>
                    </div>
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <button
                        type="button"
                        onClick={copyInstructions}
                        data-testid="paste-from-ai-copy-instructions"
                        className="flex h-10 items-center gap-2 rounded-xl border border-edge px-3 text-sm font-medium text-bright transition-colors hover:border-faint hover:text-strong"
                    >
                        <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
                        {t("authoring.copyInstructions")}
                    </button>
                    <a
                        href={new URL(AUTHORING_SCHEMA_URL).pathname}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid="paste-from-ai-format-link"
                        className="flex items-center gap-1.5 text-sm text-dim underline-offset-4 transition-colors hover:text-strong hover:underline"
                    >
                        {t("authoring.formatLink")}
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                </div>
                <p role="status" className={copyState === "copied" ? "-mt-2 mb-4 text-sm text-accent" : "sr-only"} data-testid="paste-from-ai-copy-status">
                    {copyState === "copied" ? t("authoring.copyInstructionsDone") : ""}
                </p>
                {copyState === "denied" && (
                    <div className="-mt-2 mb-4" data-testid="paste-from-ai-copy-fallback">
                        <p className="mb-1.5 text-sm text-mid">{t("authoring.copyInstructionsFallback")}</p>
                        <textarea
                            ref={fallbackRef}
                            readOnly
                            value={instructions}
                            rows={6}
                            aria-label={t("authoring.copyInstructions")}
                            onFocus={(event) => event.currentTarget.select()}
                            className="w-full resize-y rounded-xl border border-edge bg-surface-3 px-3 py-2 font-mono text-[11px] leading-5 text-mid focus:outline-none"
                        />
                    </div>
                )}

                <label htmlFor={inputId} className="mb-1.5 text-sm font-medium text-bright">
                    {t("authoring.inputLabel")}
                </label>
                <textarea
                    id={inputId}
                    data-autofocus
                    value={text}
                    onChange={(event) => {
                        setText(event.target.value);
                        setSaveFailed(false);
                    }}
                    placeholder={t("authoring.inputPlaceholder")}
                    spellCheck={false}
                    rows={8}
                    // A generous character cap; the byte limit is enforced by the parser.
                    maxLength={MAX_AUTHORING_TEXT_BYTES * 2}
                    data-testid="paste-from-ai-input"
                    className="min-h-40 w-full resize-y rounded-xl border border-edge bg-surface-3 px-3 py-2.5 font-mono text-xs leading-5 text-strong placeholder:font-sans placeholder:text-sm placeholder:text-faint focus:border-accent/60 focus:outline-none"
                />

                <div className="mt-4 space-y-4">
                    {!stale && blockedMessage && (
                        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-danger-soft" data-testid="paste-from-ai-blocked">
                            {blockedMessage}
                        </p>
                    )}

                    {!stale && parsed.status === "full-export" && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-edge bg-surface-3 px-3 py-2.5" data-testid="paste-from-ai-full-export">
                            <p className="min-w-0 text-sm text-mid">{t("authoring.fullExport")}</p>
                            {onFullExport && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onFullExport(text);
                                        onClose();
                                    }}
                                    data-testid="paste-from-ai-full-export-import"
                                    className="h-9 shrink-0 rounded-lg border border-edge px-3 text-sm font-medium text-bright transition-colors hover:border-faint hover:text-strong"
                                >
                                    {t("authoring.fullExportAction")}
                                </button>
                            )}
                        </div>
                    )}

                    {!stale && converted && <AuthoringImportSummary result={converted} parseNotices={parsed.notices} />}

                    {saveFailed && (
                        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-danger-soft" data-testid="paste-from-ai-save-error">
                            {t("authoring.saveError")}
                        </p>
                    )}
                </div>

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button
                        type="button"
                        onClick={close}
                        disabled={saving}
                        data-testid="paste-from-ai-cancel"
                        className="h-10 rounded-xl border border-edge px-4 text-sm font-medium text-bright transition-colors hover:border-faint hover:text-strong disabled:opacity-40"
                    >
                        {t("authoring.cancel")}
                    </button>
                    <button
                        type="button"
                        onClick={handleImport}
                        disabled={!converted || stale || saving}
                        aria-busy={saving}
                        data-testid="paste-from-ai-import"
                        className="flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-medium text-surface-2 transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                        {saving ? t("authoring.importing") : saveFailed ? t("authoring.retry") : t("authoring.import")}
                    </button>
                </div>
            </div>
        </div>
    );
}
