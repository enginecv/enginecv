/**
 * Single source of truth for the resume export formats.
 *
 * The export dialog, the command palette, preferences validation and
 * `runResumeExport` all read this list, so adding a format here is the only
 * place its identity (id, extension, MIME type, copy keys) is declared.
 * Kept free of UI imports: icons are mapped by the component layer.
 */

export const EXPORT_FORMAT_IDS = ["json", "pdf", "html", "png", "svg", "docx", "md", "txt"] as const;

export type ResumeExportFormat = (typeof EXPORT_FORMAT_IDS)[number];

export type ExportFormatOption = "photo";

export interface ExportFormatDescriptor {
    id: ResumeExportFormat;
    extension: string;
    mimeType: string;
    labelKey: string;
    descriptionKey: string;
    /** Whether the encryption controls apply (JSON directly, PDF via its sidecar). */
    supportsEncryption: boolean;
    options: readonly ExportFormatOption[];
    /** Built from the rendered preview pages, so a phone must show the preview first. */
    needsPreview: boolean;
}

export const EXPORT_FORMATS: readonly ExportFormatDescriptor[] = [
    { id: "json", extension: "json", mimeType: "application/json", labelKey: "export.json", descriptionKey: "export.jsonDesc", supportsEncryption: true, options: [], needsPreview: false },
    { id: "pdf", extension: "pdf", mimeType: "application/pdf", labelKey: "export.pdf", descriptionKey: "export.pdfDesc", supportsEncryption: true, options: [], needsPreview: true },
    { id: "docx", extension: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", labelKey: "export.docx", descriptionKey: "export.docxDesc", supportsEncryption: false, options: ["photo"], needsPreview: false },
    { id: "md", extension: "md", mimeType: "text/markdown;charset=utf-8", labelKey: "export.markdown", descriptionKey: "export.markdownDesc", supportsEncryption: false, options: [], needsPreview: false },
    { id: "txt", extension: "txt", mimeType: "text/plain;charset=utf-8", labelKey: "export.txt", descriptionKey: "export.txtDesc", supportsEncryption: false, options: [], needsPreview: false },
    { id: "html", extension: "html", mimeType: "text/html", labelKey: "export.html", descriptionKey: "export.htmlDesc", supportsEncryption: false, options: [], needsPreview: true },
    { id: "png", extension: "png", mimeType: "image/png", labelKey: "export.png", descriptionKey: "export.pngDesc", supportsEncryption: false, options: [], needsPreview: true },
    { id: "svg", extension: "svg", mimeType: "image/svg+xml", labelKey: "export.svg", descriptionKey: "export.svgDesc", supportsEncryption: false, options: [], needsPreview: true },
];

export function isResumeExportFormat(value: unknown): value is ResumeExportFormat {
    return typeof value === "string" && (EXPORT_FORMAT_IDS as readonly string[]).includes(value);
}

export function getExportFormat(id: ResumeExportFormat): ExportFormatDescriptor {
    const format = EXPORT_FORMATS.find((entry) => entry.id === id);
    if (!format) throw new Error(`Unknown export format: ${id}`);
    return format;
}

/** Number of downloadable formats. Public copy that states a count must use this. */
export function getExportFormatCount(): number {
    return EXPORT_FORMATS.length;
}

/** Comma-separated format names in registry order, for copy that lists the formats. */
export function getExportFormatLabels(t: (key: string) => string): string {
    return EXPORT_FORMATS.map((format) => t(format.labelKey)).join(", ");
}

/** Interpolation params for public copy that states the format count or lists the formats. */
export function getExportFormatClaimParams(t: (key: string) => string): { formatCount: number; formats: string } {
    return { formatCount: getExportFormatCount(), formats: getExportFormatLabels(t) };
}
