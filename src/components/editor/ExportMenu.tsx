"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlignLeft, Check, Copy, FileCode, FileJson, FileText, FileType, Github, Globe, Loader2, Lock, Sigma, UserRound, Download, type LucideIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { ConversionLossSummary } from "@/components/import/ConversionLossSummary";
import { resumeToJsonResume } from "@/lib/json-resume/from-resume";
import type { Resume } from "@/lib/schema";
import { EXPORT_FORMATS, getExportFormat, isResumeExportFormat, type ResumeExportFormat } from "@/lib/export-formats";
import { ExportModuleLoadError, getResumeExportBaseName, loadDocxExporter, runResumeExport, type ResumeExportNotice } from "@/lib/resume-export";
import { ClipboardDeniedError, copyTextToClipboard } from "@/lib/export-clipboard";
import { buildSelfContainedHtmlDocument, hasPreviewPages, waitForPreviewPages } from "@/lib/export";
import { ExportEmbedError } from "@/lib/export-embed";
import { toDocumentModel } from "@/lib/document-model";
import { toLatex } from "@/lib/export-latex";
import { toMarkdown } from "@/lib/export-markdown";
import { toPlainText } from "@/lib/export-plaintext";
import type { ClientPreferences } from "@/lib/preferences/schema";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import { PasswordField } from "@/components/ui/PasswordField";
import { recordSuccessfulExport, shouldAskExportRating, useExportRatingPromptStore, useExportSupportPromptStore } from "@/lib/preferences/export-support";
import { markPrintTipSeen } from "@/lib/preferences/onboarding";
import { PrintPathTip } from "@/components/editor/PrintPathTip";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { ExportDialogFrame, ExportNotice, ExportToggleRow } from "@/components/editor/export-dialog-parts";
import { GithubReadmeDialog } from "@/components/editor/GithubReadmeDialog";
import dynamic from "next/dynamic";

// Loaded with the export dialog, not the editor: it pulls in the authoring module.
const CopyForAiPanel = dynamic(() => import("@/components/editor/CopyForAiPanel").then((module) => module.CopyForAiPanel), { ssr: false });

interface ExportMenuProps {
    resume: Resume;
    paperSize: "a4" | "letter";
    className?: string;
    variant?: "primary" | "minimal";
    onNeedPreview?: () => void;
}

interface ExportDialogProps {
    open: boolean;
    onClose: () => void;
    resume: Resume;
    paperSize: "a4" | "letter";
    /**
     * Shows the preview pane. HTML, PNG, SVG and PDF are built from the rendered
     * pages, which a phone mounts only while the preview pane is visible.
     */
    onNeedPreview?: () => void;
}

type ExportPrefs = ClientPreferences["export"];

/** Formats whose output is text the user can paste straight into a form or editor. */
const COPYABLE_FORMATS = ["txt", "md", "html", "tex"] as const satisfies readonly ResumeExportFormat[];
type CopyableFormat = (typeof COPYABLE_FORMATS)[number];

function isCopyableFormat(format: ResumeExportFormat): format is CopyableFormat {
    return (COPYABLE_FORMATS as readonly ResumeExportFormat[]).includes(format);
}

const DEFAULT_EXPORT_PREFS: ExportPrefs = {
    format: "pdf",
    pdfIncludeSidecar: false,
    docxIncludePhoto: false,
};

export const EXPORT_FORMAT_ICONS: Record<ResumeExportFormat, LucideIcon> = {
    json: FileJson,
    jsonresume: FileJson,
    pdf: FileType,
    docx: FileText,
    md: FileCode,
    txt: AlignLeft,
    tex: Sigma,
    html: Globe,
};

export function isMobilePdfExportEnvironment() {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;

    const navigatorWithUaData = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
    const userAgent = navigator.userAgent || "";
    const isTouchMac = navigator.maxTouchPoints > 1 && /\bMacintosh\b/.test(userAgent);
    const isMobileUserAgent =
        navigatorWithUaData.userAgentData?.mobile === true ||
        /\b(Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet)\b/i.test(userAgent) ||
        isTouchMac;
    const hasMobilePointer = window.matchMedia?.("(pointer: coarse)")?.matches === true;
    const isMobileViewport = window.matchMedia?.("(max-width: 1023px)")?.matches === true;

    return isMobileUserAgent || (hasMobilePointer && isMobileViewport);
}

function loadExportPrefs(): ExportPrefs {
    const store = useClientPreferencesStore.getState();
    if (!store.hydrated) store.hydrate();
    return useClientPreferencesStore.getState().preferences.export ?? DEFAULT_EXPORT_PREFS;
}

function saveExportPrefs(prefs: ExportPrefs) {
    useClientPreferencesStore.getState().updateSection("export", prefs);
}

export function ExportDialog({ open, onClose, resume, paperSize, onNeedPreview }: ExportDialogProps) {
    const { t } = useTranslation();
    const [prefs] = useState(loadExportPrefs);
    const [pdfIncludeSidecar, setPdfIncludeSidecar] = useState<boolean>(prefs.pdfIncludeSidecar);
    const [docxIncludePhoto, setDocxIncludePhoto] = useState<boolean>(prefs.docxIncludePhoto);
    // Off by default and not remembered: the photo is written into the file as image data.
    const [jsonResumeIncludePhoto, setJsonResumeIncludePhoto] = useState(false);
    const [exportNotices, setExportNotices] = useState<ResumeExportNotice[]>([]);
    const [fallbackFonts, setFallbackFonts] = useState<string[]>([]);
    const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "copied">("idle");
    // A remembered format that no longer exists (PNG and SVG were removed) opens on the default.
    const [selectedFormat, setSelectedFormat] = useState<ResumeExportFormat>(isResumeExportFormat(prefs.format) ? prefs.format : DEFAULT_EXPORT_PREFS.format);
    const [jsonEncrypt, setJsonEncrypt] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [exportingFormat, setExportingFormat] = useState<ResumeExportFormat | null>(null);
    const [encryptionKey, setEncryptionKey] = useState("");
    const [confirmEncryptionKey, setConfirmEncryptionKey] = useState("");
    const [exportError, setExportError] = useState<string | null>(null);
    const [mobilePdfUnsupported, setMobilePdfUnsupported] = useState(false);
    const [readmeOpen, setReadmeOpen] = useState(false);

    // What the selected format cannot hold for this CV, shown before the download.
    const lossReport = useMemo(
        () => (selectedFormat === "jsonresume" ? resumeToJsonResume(resume, { includePhoto: jsonResumeIncludePhoto }).report : null),
        [selectedFormat, resume, jsonResumeIncludePhoto],
    );
    // The README dialog replaces this one; it owns focus and Escape while shown.
    const formatsOpen = open && !readmeOpen;

    const exportMessages = {
        secureEncryptedExportUnavailable: t("export.secureEncryptedExportUnavailable"),
        printDialogUnavailable: t("export.printDialogUnavailable"),
        encryptionKeyRequired: t("export.encryptionKeyRequired"),
    };

    useEffect(() => {
        if (!formatsOpen) return;

        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };

        document.addEventListener("keydown", handleEsc);
        return () => document.removeEventListener("keydown", handleEsc);
    }, [formatsOpen, onClose]);

    useEffect(() => {
        if (!open) return;

        const { overflow } = document.body.style;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = overflow;
        };
    }, [open]);

    useEffect(() => {
        if (!open) {
            setExportError(null);
            setExportNotices([]);
            setCopyStatus("idle");
            setEncryptionKey("");
            setConfirmEncryptionKey("");
            setReadmeOpen(false);
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;

        const updateMobilePdfSupport = () => setMobilePdfUnsupported(isMobilePdfExportEnvironment());
        const coarsePointerQuery = window.matchMedia?.("(pointer: coarse)");
        const mobileViewportQuery = window.matchMedia?.("(max-width: 1023px)");

        updateMobilePdfSupport();
        window.addEventListener("resize", updateMobilePdfSupport);
        coarsePointerQuery?.addEventListener("change", updateMobilePdfSupport);
        mobileViewportQuery?.addEventListener("change", updateMobilePdfSupport);

        return () => {
            window.removeEventListener("resize", updateMobilePdfSupport);
            coarsePointerQuery?.removeEventListener("change", updateMobilePdfSupport);
            mobileViewportQuery?.removeEventListener("change", updateMobilePdfSupport);
        };
    }, [open]);

    const dialogRef = useDialogFocus<HTMLDivElement>(formatsOpen); // Escape is already handled by this dialog.

    if (!open) return null;

    if (readmeOpen) {
        return createPortal(
            <GithubReadmeDialog resume={resume} onBack={() => setReadmeOpen(false)} onClose={onClose} />,
            document.body,
        );
    }

    const shouldEncryptPayload = (format: ResumeExportFormat) =>
        jsonEncrypt && (format === "json" || (format === "pdf" && pdfIncludeSidecar));

    /** Mounts the preview pages a format is built from; false if they never appear. */
    const ensurePreviewPages = async (format: ResumeExportFormat): Promise<boolean> => {
        if (!getExportFormat(format).needsPreview || hasPreviewPages()) return true;
        onNeedPreview?.();
        return waitForPreviewPages();
    };

    const handleExport = async (format: ResumeExportFormat) => {
        if (shouldEncryptPayload(format)) {
            if (encryptionKey.length < 8) {
                setExportError(t("export.encryptionKeyTooShort"));
                return;
            }

            if (encryptionKey !== confirmEncryptionKey) {
                setExportError(t("export.encryptionKeysMismatch"));
                return;
            }
        }

        setExportError(null);
        setExportNotices([]);
        setFallbackFonts([]);
        setExporting(true);
        setExportingFormat(format);
        try {
            if (!(await ensurePreviewPages(format))) throw new Error(t("export.failed"));
            const { notices, fallbackFonts: fonts } = await runResumeExport({
                resume,
                paperSize,
                format,
                encryptionKey: jsonEncrypt ? encryptionKey : undefined,
                pdfIncludeSidecar,
                docxIncludePhoto,
                jsonResumeIncludePhoto,
                messages: exportMessages,
            });
            saveExportPrefs({ format: selectedFormat, pdfIncludeSidecar, docxIncludePhoto });
            if (format === "pdf") markPrintTipSeen();
            if ((format === "pdf" || format === "docx") && recordSuccessfulExport()) {
                useExportSupportPromptStore.getState().show();
            }
            if ((format === "pdf" || format === "docx") && shouldAskExportRating()) {
                useExportRatingPromptStore.getState().show(format);
            }
            // Keep the dialog open when the export succeeded with a caveat worth reading.
            if (fonts?.length) setFallbackFonts(fonts);
            if (notices.length > 0) setExportNotices(notices);
            else onClose();
        } catch (error) {
            setExportError(error instanceof ExportEmbedError
                ? t("export.htmlEmbedFailed")
                : error instanceof ExportModuleLoadError
                ? t("export.docxLoadFailed")
                : error instanceof Error ? error.message : t("export.failed"));
        } finally {
            setExporting(false);
            setExportingFormat(null);
        }
    };

    /** Same payload as the downloaded file, so a paste matches what Export would save. */
    const serializeForCopy = (format: CopyableFormat): string | Promise<string> => {
        if (format === "html") {
            // Embedding styles and fonts takes time, so hand the clipboard a promise
            // (started now, inside the user gesture) instead of awaiting here.
            return buildSelfContainedHtmlDocument(paperSize, `resume-${getResumeExportBaseName(resume)}.html`).then((result) => {
                if (result === null) throw new Error(t("export.failed"));
                return result.html;
            });
        }
        const model = toDocumentModel(resume);
        if (format === "tex") return toLatex(model, { paperSize });
        return format === "md" ? toMarkdown(model) : toPlainText(model);
    };

    const handleCopy = async (format: CopyableFormat) => {
        setExportError(null);
        setCopyStatus("copying");
        try {
            // Serialize before the first await: Safari drops the user gesture across async gaps.
            // Picking HTML already showed the preview, so waiting for it is only a fallback.
            if (getExportFormat(format).needsPreview && !hasPreviewPages()) {
                if (!(await ensurePreviewPages(format))) throw new Error(t("export.failed"));
            }
            await copyTextToClipboard(serializeForCopy(format));
            setCopyStatus("copied");
        } catch (error) {
            setCopyStatus("idle");
            setExportError(
                error instanceof ClipboardDeniedError ? t("export.copyFailed")
                    : error instanceof ExportEmbedError ? t("export.htmlEmbedFailed")
                    : t("export.failed"),
            );
        }
    };

    const selectFormat = (format: ResumeExportFormat) => {
        setSelectedFormat(format);
        setExportError(null);
        setExportNotices([]);
        setCopyStatus("idle");
        if (getExportFormat(format).needsPreview && !hasPreviewPages()) onNeedPreview?.();
        // Warm the lazily loaded Word exporter while the user reads the options.
        if (format === "docx") void loadDocxExporter().catch(() => undefined);
    };

    const formatCards = EXPORT_FORMATS.map((format) => ({
        id: format.id,
        icon: EXPORT_FORMAT_ICONS[format.id],
        label: t(format.labelKey),
        description: t(format.descriptionKey),
        lossy: format.lossy === true,
    }));


    const selectedFormatConfig = formatCards.find((format) => format.id === selectedFormat) ?? formatCards[0];

    const renderToggleRow = (checked: boolean, onToggle: () => void, Icon: LucideIcon, title: string, description: string, testId?: string) => (
        <ExportToggleRow checked={checked} onToggle={onToggle} icon={Icon} title={title} description={description} testId={testId} />
    );

    const renderNotice = (title: string, body: string, testId?: string) => <ExportNotice title={title} body={body} testId={testId} />;

    const renderEncryptionOptions = (title: string, description: string) => (
        <>
            {renderToggleRow(jsonEncrypt, () => setJsonEncrypt(!jsonEncrypt), Lock, title, description)}

            {jsonEncrypt && (
                <div className="mt-3 space-y-3">
                    {renderNotice(t("export.encryptionWarningTitle"), t("export.encryptionWarningBody"))}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <PasswordField
                            label={t("export.encryptionKey")}
                            value={encryptionKey}
                            onChange={(value) => {
                                setEncryptionKey(value);
                                setExportError(null);
                            }}
                            autoComplete="new-password"
                            spellCheck={false}
                            placeholder={t("export.encryptionKeyPlaceholder")}
                        />
                        <PasswordField
                            label={t("export.confirmKey")}
                            value={confirmEncryptionKey}
                            onChange={(value) => {
                                setConfirmEncryptionKey(value);
                                setExportError(null);
                            }}
                            autoComplete="new-password"
                            spellCheck={false}
                            placeholder={t("export.confirmKeyPlaceholder")}
                        />
                    </div>

                    <p className="text-xs leading-relaxed text-faint">{t("export.encryptionKeyHint")}</p>
                </div>
            )}
        </>
    );

    const renderJsonOptions = () => renderEncryptionOptions(
        t("export.encryptExport"),
        t("export.encryptExportDesc")
    );

    const renderPdfOptions = () => (
        <>
            {mobilePdfUnsupported && (
                <div className="mb-3">
                    {renderNotice(
                        t("export.mobilePdfUnsupportedTitle"),
                        t("export.mobilePdfUnsupportedBody"),
                        "export-mobile-pdf-warning",
                    )}
                </div>
            )}

            {!mobilePdfUnsupported && <PrintPathTip />}

            {renderToggleRow(
                pdfIncludeSidecar,
                () => setPdfIncludeSidecar(!pdfIncludeSidecar),
                FileJson,
                t("export.downloadSidecar"),
                t("export.downloadSidecarDesc"),
            )}

            {pdfIncludeSidecar && (
                <div className="mt-3 space-y-3">
                    <p className="px-2 text-xs leading-relaxed text-mid">{t("export.downloadSidecarHint")}</p>
                    {renderEncryptionOptions(
                        t("export.encryptSidecar"),
                        t("export.encryptSidecarDesc")
                    )}
                </div>
            )}
        </>
    );

    const renderDocxOptions = () => renderToggleRow(
        docxIncludePhoto,
        () => setDocxIncludePhoto(!docxIncludePhoto),
        UserRound,
        t("export.docxIncludePhoto"),
        t("export.docxIncludePhotoHint"),
        "export-docx-include-photo",
    );

    const renderJsonResumeOptions = () => (
        <div className="space-y-3">
            {renderToggleRow(
                jsonResumeIncludePhoto,
                () => setJsonResumeIncludePhoto(!jsonResumeIncludePhoto),
                UserRound,
                t("export.jsonresumeIncludePhoto"),
                t("export.jsonresumeIncludePhotoHint"),
                "export-jsonresume-include-photo",
            )}
            {lossReport && <ConversionLossSummary report={lossReport} defaultOpen />}
        </div>
    );

    const renderCopyOptions = (format: CopyableFormat) => (
        <button
            type="button"
            onClick={() => void handleCopy(format)}
            disabled={exporting || copyStatus === "copying"}
            data-testid="export-copy-clipboard"
            aria-live="polite"
            className="ml-2 flex h-8 items-center gap-2 rounded-lg border border-edge px-2.5 text-xs text-mid transition-colors hover:bg-surface-4 hover:text-strong disabled:cursor-wait disabled:opacity-50"
        >
            {copyStatus === "copied" ? (
                <Check className="h-3.5 w-3.5 text-accent" />
            ) : copyStatus === "copying" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
                <Copy className="h-3.5 w-3.5" />
            )}
            {copyStatus === "copied"
                ? t("export.copied")
                : t("export.copyFormat", { format: selectedFormatConfig.label })}
        </button>
    );

    const renderDefaultOptions = () => (
        <p className="px-2 text-xs leading-relaxed text-mid">{t("export.readyToDownload")}</p>
    );

    const exportDisabled =
        exporting ||
        (selectedFormat === "pdf" && mobilePdfUnsupported) ||
        (shouldEncryptPayload(selectedFormat) && (!encryptionKey || !confirmEncryptionKey));

    return (
        <ExportDialogFrame
            dialogRef={dialogRef}
            onClose={onClose}
            formatCards={formatCards}
            selectedFormat={selectedFormat}
            onSelectFormat={selectFormat}
            exporting={exporting}
            exportingFormat={exportingFormat}
            confirmLabel={selectedFormatConfig.label}
            confirmDisabled={exportDisabled}
            onConfirm={() => handleExport(selectedFormat)}
            top={
                <>
                    <button
                        type="button"
                        onClick={() => setReadmeOpen(true)}
                        disabled={exporting}
                        data-testid="export-github-readme"
                        className="mb-4 flex w-full items-center gap-3 rounded-xl border border-edge px-3 py-2.5 text-left transition-colors hover:border-accent/40 hover:bg-surface-2 disabled:cursor-wait disabled:opacity-50"
                    >
                        <Github className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                        <span className="min-w-0">
                            <span className="block text-sm font-medium text-strong">{t("githubReadme.entry")}</span>
                            <span className="block text-xs leading-relaxed text-faint">{t("githubReadme.entryDesc")}</span>
                        </span>
                    </button>

                    <CopyForAiPanel resume={resume} />
                </>
            }
        >
            <p className="px-2 text-sm text-strong">{selectedFormatConfig.description}</p>

            <div className="mt-3">
                {selectedFormat === "json" ? renderJsonOptions()
                    : selectedFormat === "jsonresume" ? renderJsonResumeOptions()
                    : selectedFormat === "pdf" ? renderPdfOptions()
                    : selectedFormat === "docx" ? renderDocxOptions()
                    : isCopyableFormat(selectedFormat) ? renderCopyOptions(selectedFormat)
                    : renderDefaultOptions()}
            </div>

            {selectedFormat === "tex" && (
                <div className="mt-3">
                    {renderNotice(t("export.latexNoteTitle"), t("export.latexNote"), "export-latex-note")}
                </div>
            )}

            {exportNotices.includes("docxPhotoSkipped") && (
                <div className="mt-3">
                    {renderNotice(t("export.docxPhotoSkippedTitle"), t("export.docxPhotoSkipped"), "export-docx-photo-skipped")}
                </div>
            )}

            {exportNotices.includes("htmlFontFallback") && (
                <div className="mt-3">
                    {renderNotice(t("export.htmlFontFallbackTitle"), t("export.htmlFontFallback", { fonts: fallbackFonts.join(", ") }), "export-html-font-fallback")}
                </div>
            )}

            {exportError && (
                <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-danger-soft">
                    {exportError}
                </p>
            )}
        </ExportDialogFrame>
    );
}

export function ExportMenu({ resume, paperSize, className = "", variant = "primary", onNeedPreview }: ExportMenuProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    const buttonClass = variant === "primary"
        ? "flex h-8 items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-2.5 text-xs font-medium text-accent transition-colors hover:border-accent/50 hover:bg-accent/15 cursor-pointer"
        : "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-accent hover:text-accent-soft hover:bg-edge transition-colors cursor-pointer";

    return (
        <div className={className}>
            <button type="button" onClick={() => setOpen(true)} data-testid="export-menu-button" className={buttonClass}>
                <Download className={variant === "primary" ? "h-3.5 w-3.5" : "h-4 w-4"} />
                <span>{t("export.button")}</span>
            </button>
            <ExportDialog open={open} onClose={() => setOpen(false)} resume={resume} paperSize={paperSize} onNeedPreview={onNeedPreview} />
        </div>
    );
}
