"use client";

import { AlertTriangle, Coffee, Download, Loader2, X, type LucideIcon } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "@/lib/i18n";
import type { ResumeExportFormat } from "@/lib/export-formats";
import { getKofiUrl } from "@/lib/support";

/**
 * The pieces of the export dialog that are the same for a CV and a cover letter: the frame
 * (title, format grid, footer with the support link and the export button), the switch row
 * and the notice. The CV's dialog and the letter's dialog both render these, so exporting
 * looks and behaves the same everywhere.
 */

/** Columns in the format picker; keep in sync with the grid-cols class in the frame. */
export const FORMAT_GRID_COLUMNS = 4;

export interface ExportFormatCard {
    id: ResumeExportFormat;
    icon: LucideIcon;
    label: string;
    description: string;
    lossy: boolean;
}

/** Compact switch row: the dialog's only affordance for a boolean option. */
export function ExportToggleRow({ checked, onToggle, icon: Icon, title, description, testId }: {
    checked: boolean;
    onToggle: () => void;
    icon: LucideIcon;
    title: string;
    description: string;
    testId?: string;
}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            role="switch"
            aria-checked={checked}
            data-testid={testId}
            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-2"
        >
            <span className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-edge"}`}>
                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-surface-1 transition-all ${checked ? "left-3.5" : "left-0.5"}`} />
            </span>
            <Icon className={`h-3.5 w-3.5 shrink-0 ${checked ? "text-accent" : "text-faint"}`} />
            <span className="min-w-0">
                <span className="block text-sm text-strong">{title}</span>
                <span className="block text-xs leading-relaxed text-faint">{description}</span>
            </span>
        </button>
    );
}

/** Inline amber notice, used for the encryption, mobile-PDF and letter warnings. */
export function ExportNotice({ title, body, children, testId }: { title: string; body?: string; children?: ReactNode; testId?: string }) {
    return (
        <div data-testid={testId} className="flex items-start gap-2.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <div className="min-w-0">
                <p className="text-xs font-medium text-strong">{title}</p>
                {body && <p className="mt-0.5 text-xs leading-relaxed text-mid">{body}</p>}
                {children}
            </div>
        </div>
    );
}

export function ExportDialogFrame({
    dialogRef,
    onClose,
    formatCards,
    selectedFormat,
    onSelectFormat,
    exporting,
    exportingFormat,
    confirmLabel,
    confirmDisabled,
    onConfirm,
    top,
    children,
}: {
    dialogRef: RefObject<HTMLDivElement | null>;
    onClose: () => void;
    formatCards: ExportFormatCard[];
    selectedFormat: ResumeExportFormat;
    onSelectFormat: (format: ResumeExportFormat) => void;
    exporting: boolean;
    exportingFormat: ResumeExportFormat | null;
    /** The selected format's name, for "Export PDF". */
    confirmLabel: string;
    confirmDisabled: boolean;
    onConfirm: () => void;
    /** Extra entries above the format description (the CV adds its GitHub README and AI copy panels). */
    top?: ReactNode;
    /** The selected format's description, options, notices and errors. */
    children: ReactNode;
}) {
    const { t } = useTranslation();
    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-[10vh]">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose} />

            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="export-dialog-title"
                className="relative flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-edge bg-surface-1 shadow-2xl animate-in zoom-in-95 fade-in slide-in-from-top-2 duration-200"
            >
                <div className="shrink-0 px-5 pt-5">
                    <button type="button" onClick={onClose} aria-label={t("dashboard.cancel")} className="absolute right-4 top-4 text-faint transition-colors hover:text-strong">
                        <X className="h-4 w-4" />
                    </button>

                    <h2 id="export-dialog-title" className="text-base font-semibold tracking-tight text-strong">{t("export.title")}</h2>
                    <p className="mt-1 text-xs leading-relaxed text-mid">{t("export.subtitle")}</p>

                    <div className="mt-4 grid grid-cols-4 gap-1 rounded-xl border border-edge bg-surface-2 p-1">
                        {formatCards.map((format, index) => {
                            const active = selectedFormat === format.id;
                            // The last card fills the cells left in its row (7 cards: 4 + 3, so it spans 2).
                            const leftover = formatCards.length % FORMAT_GRID_COLUMNS;
                            const span = index === formatCards.length - 1 && leftover !== 0 ? FORMAT_GRID_COLUMNS - leftover + 1 : 1;
                            return (
                                <button
                                    key={format.id}
                                    type="button"
                                    style={span > 1 ? { gridColumn: `span ${span}` } : undefined}
                                    onClick={() => onSelectFormat(format.id)}
                                    data-testid={`export-format-${format.id}`}
                                    disabled={exporting}
                                    aria-pressed={active}
                                    className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-medium transition-colors disabled:cursor-wait disabled:opacity-50 ${
                                        active ? "bg-surface-4 text-strong" : "text-faint hover:bg-surface-4/50 hover:text-bright"
                                    }`}
                                >
                                    <format.icon className={`h-4 w-4 ${active ? "text-accent" : ""}`} />
                                    <span className="flex items-center gap-1">
                                        {format.label}
                                        {format.lossy && (
                                            <span role="img" aria-label={t("conversion.marker")} title={t("conversion.marker")} data-testid={`export-format-lossy-${format.id}`}>
                                                <AlertTriangle className="h-3 w-3 text-accent" aria-hidden="true" />
                                            </span>
                                        )}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    {top}
                    {children}
                </div>

                <div className="flex shrink-0 flex-col gap-3 border-t border-edge px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <a
                        href={getKofiUrl("export-dialog")}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center gap-2 self-start rounded-lg px-2.5 text-xs text-faint transition-colors hover:bg-surface-4 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                        <Coffee className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("landing.support.cta")}
                    </a>
                    <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={onClose} className="flex h-8 items-center rounded-lg px-2.5 text-xs text-mid transition-colors hover:bg-surface-4 hover:text-strong">
                            {t("dashboard.cancel")}
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={confirmDisabled}
                            data-testid="export-confirm-button"
                            className="flex h-8 items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-2.5 text-xs font-medium text-accent transition-colors hover:border-accent/50 hover:bg-accent/15 disabled:cursor-wait disabled:opacity-40"
                        >
                            {exporting && exportingFormat === selectedFormat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            {t("export.exportFormat", { format: confirmLabel })}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}
