"use client";

import { Check, Copy, Download, Loader2, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EXPORT_FORMAT_ICONS, isMobilePdfExportEnvironment } from "@/components/editor/ExportMenu";
import { ExportDialogFrame, ExportNotice, ExportToggleRow, type ExportFormatCard } from "@/components/editor/export-dialog-parts";
import { PrintPathTip } from "@/components/editor/PrintPathTip";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { buildSelfContainedHtmlDocument, hasPreviewPages, waitForPreviewPages } from "@/lib/export";
import { ExportEmbedError } from "@/lib/export-embed";
import { ClipboardDeniedError, copyTextToClipboard } from "@/lib/export-clipboard";
import { EXPORT_FORMATS, getExportFormat, type ResumeExportFormat } from "@/lib/export-formats";
import { useTranslation } from "@/lib/i18n";
import { toLetterLatex } from "@/lib/letters/export-latex";
import { toLetterMarkdown, toLetterPlainText } from "@/lib/letters/export-text";
import { letterFileBaseName } from "@/lib/letters/file-name";
import type { ResolvedLetter } from "@/lib/letters/resolve";
import { LETTER_EXPORT_FORMATS, loadLetterDocxExporter, runLetterExport } from "@/lib/letters/run-export";
import { recordSuccessfulExport, useExportSupportPromptStore } from "@/lib/preferences/export-support";
import { markPrintTipSeen } from "@/lib/preferences/onboarding";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import { ExportModuleLoadError, type ResumeExportNotice } from "@/lib/resume-export";
import { warningText } from "./warnings";

type CopyableFormat = "txt" | "md" | "html" | "tex";
const isCopyable = (format: ResumeExportFormat): format is CopyableFormat => format === "txt" || format === "md" || format === "html" || format === "tex";

const LETTER_FORMATS = EXPORT_FORMATS.filter((format) => LETTER_EXPORT_FORMATS.includes(format.id));

function loadPrefs() {
    const store = useClientPreferencesStore.getState();
    if (!store.hydrated) store.hydrate();
    return useClientPreferencesStore.getState().preferences.export;
}

/**
 * The cover letter's export dialog. It is the CV's dialog with the letter's formats: the same
 * frame, format grid, options, copy-to-clipboard, print tip, mobile PDF warning, support link,
 * remembered choices and notices. What looks unfinished about the letter is shown in the
 * dialog as a notice, not as a second dialog.
 */
export function LetterExportDialog({ open, onClose, letter, onNeedPreview }: {
    open: boolean;
    onClose: () => void;
    letter: ResolvedLetter;
    /** Shows the preview pane, which a phone mounts only while it is visible. */
    onNeedPreview?: () => void;
}) {
    const { t } = useTranslation();
    const [prefs] = useState(loadPrefs);
    const [selectedFormat, setSelectedFormat] = useState<ResumeExportFormat>(LETTER_EXPORT_FORMATS.includes(prefs.format) ? prefs.format : "pdf");
    const [docxIncludePhoto, setDocxIncludePhoto] = useState<boolean>(prefs.docxIncludePhoto);
    const [exporting, setExporting] = useState(false);
    const [exportingFormat, setExportingFormat] = useState<ResumeExportFormat | null>(null);
    const [exportError, setExportError] = useState<string | null>(null);
    const [notices, setNotices] = useState<ResumeExportNotice[]>([]);
    const [fallbackFonts, setFallbackFonts] = useState<string[]>([]);
    const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "copied">("idle");
    const [mobilePdfUnsupported, setMobilePdfUnsupported] = useState(false);
    const dialogRef = useDialogFocus<HTMLDivElement>(open);

    const warnings = letter.warnings.filter((warning) => warning.code !== "cv-missing");

    useEffect(() => {
        if (!open) {
            setExportError(null);
            setNotices([]);
            setCopyStatus("idle");
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const { overflow } = document.body.style;
        document.body.style.overflow = "hidden";
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = overflow;
            document.removeEventListener("keydown", onKey);
        };
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return;
        const update = () => setMobilePdfUnsupported(isMobilePdfExportEnvironment());
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, [open]);

    const formatCards = useMemo<ExportFormatCard[]>(() => LETTER_FORMATS.map((format) => ({
        id: format.id,
        icon: EXPORT_FORMAT_ICONS[format.id],
        label: t(format.labelKey),
        description: t(format.descriptionKey),
        lossy: false,
    })), [t]);

    if (!open) return null;

    const selected = formatCards.find((card) => card.id === selectedFormat) ?? formatCards[0];

    /** Mounts the preview pages a format is built from; false if they never appear. */
    const ensurePreviewPages = async (format: ResumeExportFormat): Promise<boolean> => {
        if (!getExportFormat(format).needsPreview || hasPreviewPages()) return true;
        onNeedPreview?.();
        return waitForPreviewPages();
    };

    const handleExport = async (format: ResumeExportFormat) => {
        setExportError(null);
        setNotices([]);
        setFallbackFonts([]);
        setExporting(true);
        setExportingFormat(format);
        try {
            if (!(await ensurePreviewPages(format))) throw new Error(t("export.failed"));
            const result = await runLetterExport({ letter, format, docxIncludePhoto, messages: { printDialogUnavailable: t("export.printDialogUnavailable") } });
            useClientPreferencesStore.getState().updateSection("export", { ...loadPrefs(), format: selectedFormat, docxIncludePhoto });
            if (format === "pdf") markPrintTipSeen();
            if ((format === "pdf" || format === "docx") && recordSuccessfulExport()) useExportSupportPromptStore.getState().show();
            // Keep the dialog open when the export succeeded with a caveat worth reading.
            if (result.fallbackFonts?.length) setFallbackFonts(result.fallbackFonts);
            if (result.notices.length > 0) setNotices(result.notices);
            else onClose();
        } catch (error) {
            setExportError(error instanceof ExportEmbedError ? t("export.htmlEmbedFailed") : error instanceof ExportModuleLoadError ? t("export.docxLoadFailed") : error instanceof Error ? error.message : t("export.failed"));
        } finally {
            setExporting(false);
            setExportingFormat(null);
        }
    };

    const serializeForCopy = (format: CopyableFormat): string | Promise<string> => {
        if (format === "html") {
            // Embedding styles and fonts takes time, so hand the clipboard a promise (started now,
            // inside the user gesture) instead of awaiting here.
            return buildSelfContainedHtmlDocument(letter.paperSize, `${letterFileBaseName(letter)}.html`).then((result) => {
                if (result === null) throw new Error(t("export.failed"));
                return result.html;
            });
        }
        if (format === "tex") return toLetterLatex(letter);
        return format === "md" ? toLetterMarkdown(letter) : toLetterPlainText(letter);
    };

    const handleCopy = async (format: CopyableFormat) => {
        setExportError(null);
        setCopyStatus("copying");
        try {
            if (getExportFormat(format).needsPreview && !hasPreviewPages() && !(await ensurePreviewPages(format))) throw new Error(t("export.failed"));
            await copyTextToClipboard(serializeForCopy(format));
            setCopyStatus("copied");
        } catch (error) {
            setCopyStatus("idle");
            setExportError(error instanceof ClipboardDeniedError ? t("export.copyFailed") : error instanceof ExportEmbedError ? t("export.htmlEmbedFailed") : t("export.failed"));
        }
    };

    const selectFormat = (format: ResumeExportFormat) => {
        setSelectedFormat(format);
        setExportError(null);
        setNotices([]);
        setCopyStatus("idle");
        if (getExportFormat(format).needsPreview && !hasPreviewPages()) onNeedPreview?.();
        // Warm the lazily loaded Word exporter while the user reads the options.
        if (format === "docx") void loadLetterDocxExporter().catch(() => undefined);
    };

    const options = (() => {
        if (selectedFormat === "pdf") {
            return (
                <>
                    {mobilePdfUnsupported && (
                        <div className="mb-3"><ExportNotice title={t("export.mobilePdfUnsupportedTitle")} body={t("export.mobilePdfUnsupportedBody")} testId="export-mobile-pdf-warning" /></div>
                    )}
                    {!mobilePdfUnsupported && <PrintPathTip />}
                </>
            );
        }
        if (selectedFormat === "docx") {
            // The photo only matters when the letter shows one.
            return letter.photo
                ? <ExportToggleRow checked={docxIncludePhoto} onToggle={() => setDocxIncludePhoto(!docxIncludePhoto)} icon={UserRound} title={t("export.docxIncludePhoto")} description={t("export.docxIncludePhotoHint")} testId="export-docx-include-photo" />
                : <p className="px-2 text-xs leading-relaxed text-mid">{t("export.readyToDownload")}</p>;
        }
        if (isCopyable(selectedFormat)) {
            return (
                <button type="button" onClick={() => void handleCopy(selectedFormat)} disabled={exporting || copyStatus === "copying"} data-testid="export-copy-clipboard" aria-live="polite" className="ml-2 flex h-8 items-center gap-2 rounded-lg border border-edge px-2.5 text-xs text-mid transition-colors hover:bg-surface-4 hover:text-strong disabled:cursor-wait disabled:opacity-50">
                    {copyStatus === "copied" ? <Check className="h-3.5 w-3.5 text-accent" /> : copyStatus === "copying" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                    {copyStatus === "copied" ? t("export.copied") : t("export.copyFormat", { format: selected.label })}
                </button>
            );
        }
        return <p className="px-2 text-xs leading-relaxed text-mid">{t("export.readyToDownload")}</p>;
    })();

    return (
        <ExportDialogFrame
            dialogRef={dialogRef}
            onClose={onClose}
            formatCards={formatCards}
            selectedFormat={selectedFormat}
            onSelectFormat={selectFormat}
            exporting={exporting}
            exportingFormat={exportingFormat}
            confirmLabel={selected.label}
            confirmDisabled={exporting || (selectedFormat === "pdf" && mobilePdfUnsupported)}
            onConfirm={() => void handleExport(selectedFormat)}
        >
            {warnings.length > 0 && (
                <div className="mb-4">
                    <ExportNotice title={t("letters.export.warningsTitle")} testId="letter-export-warnings">
                        <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-relaxed text-mid">
                            {warnings.map((warning, index) => <li key={index}>{warningText(t, warning)}</li>)}
                        </ul>
                    </ExportNotice>
                </div>
            )}

            <p className="px-2 text-sm text-strong">{selected.description}</p>
            <div className="mt-3">{options}</div>

            {selectedFormat === "tex" && (
                <div className="mt-3"><ExportNotice title={t("export.latexNoteTitle")} body={t("letters.export.latexNote")} testId="export-latex-note" /></div>
            )}

            {notices.includes("htmlFontFallback") && (
                <div className="mt-3"><ExportNotice title={t("export.htmlFontFallbackTitle")} body={t("export.htmlFontFallback", { fonts: fallbackFonts.join(", ") })} testId="export-html-font-fallback" /></div>
            )}

            {notices.includes("docxPhotoSkipped") && (
                <div className="mt-3"><ExportNotice title={t("export.docxPhotoSkippedTitle")} body={t("export.docxPhotoSkipped")} testId="export-docx-photo-skipped" /></div>
            )}

            {exportError && (
                <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-danger-soft" role="alert" data-testid="letter-export-error">{exportError}</p>
            )}
        </ExportDialogFrame>
    );
}

/** The header's Export button, styled and placed like the CV editor's. */
export function LetterExportMenu({ letter, onNeedPreview }: { letter: ResolvedLetter; onNeedPreview?: () => void }) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    return (
        <div>
            <button type="button" onClick={() => setOpen(true)} data-testid="export-menu-button" className="flex h-8 cursor-pointer items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-2.5 text-xs font-medium text-accent transition-colors hover:border-accent/50 hover:bg-accent/15">
                <Download className="h-3.5 w-3.5" />
                <span>{t("export.button")}</span>
            </button>
            <LetterExportDialog open={open} onClose={() => setOpen(false)} letter={letter} onNeedPreview={onNeedPreview} />
        </div>
    );
}
