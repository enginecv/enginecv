import { toDocumentModel } from "./document-model";
import {
    exportToEncryptedJson,
    exportToHtml,
    exportToJson,
    exportToPng,
    exportToSvg,
    triggerPdfPrint,
    type ExportMessages,
} from "./export";
import { getExportFormat, type ResumeExportFormat } from "./export-formats";
import { resumeToJsonResume } from "./json-resume/from-resume";
import type { ConversionReport } from "./json-resume/report";
import { toMarkdown } from "./export-markdown";
import { toPlainText } from "./export-plaintext";
import type { Resume } from "./schema";
import { deliverFile } from "./share";

export type { ResumeExportFormat } from "./export-formats";

export type ResumeExportNotice = "docxPhotoSkipped";

export interface RunResumeExportResult {
    notices: ResumeExportNotice[];
    /** What the format could not hold, for formats that cannot hold everything. */
    report?: ConversionReport;
}

/** The lazily loaded DOCX module could not be fetched (offline before first use, stale deploy). */
export class ExportModuleLoadError extends Error {
    constructor(cause?: unknown) {
        super("Export module failed to load");
        this.name = "ExportModuleLoadError";
        this.cause = cause;
    }
}

interface RunResumeExportOptions {
    resume: Resume;
    paperSize: "a4" | "letter";
    format: ResumeExportFormat;
    encryptionKey?: string;
    pdfIncludeSidecar?: boolean;
    docxIncludePhoto?: boolean;
    jsonResumeIncludePhoto?: boolean;
    messages?: Partial<ExportMessages>;
}

const MAX_BASE_NAME_LENGTH = 80;

export function getResumeExportBaseName(resume: Resume): string {
    const title = resume.meta.title || resume.basics.name;
    const base = title
        .toLowerCase()
        // Characters no file system accepts, plus control characters.
        .replace(/[\\/:*?"<>|]|\p{Cc}/gu, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^[-.]+|[-.]+$/g, "")
        .slice(0, MAX_BASE_NAME_LENGTH)
        .replace(/[-.]+$/, "");
    return base || "export";
}

/** Imports the DOCX builder on demand so the `docx` library stays out of the editor bundle. */
export function loadDocxExporter() {
    return import("./export-docx").catch((error: unknown) => {
        throw new ExportModuleLoadError(error);
    });
}

function textBlob(content: string, format: ResumeExportFormat): Blob {
    return new Blob([content], { type: getExportFormat(format).mimeType });
}

export async function runResumeExport({
    resume,
    paperSize,
    format,
    encryptionKey,
    pdfIncludeSidecar = false,
    docxIncludePhoto = false,
    jsonResumeIncludePhoto = false,
    messages,
}: RunResumeExportOptions): Promise<RunResumeExportResult> {
    const baseName = getResumeExportBaseName(resume);
    const notices: ResumeExportNotice[] = [];
    let report: ConversionReport | undefined;

    switch (format) {
        case "json":
            if (encryptionKey) {
                await exportToEncryptedJson(
                    resume,
                    encryptionKey,
                    `resume-${baseName}.encrypted.json`,
                    messages,
                );
            } else {
                exportToJson(resume, `resume-${baseName}.json`);
            }
            break;
        case "jsonresume": {
            const converted = resumeToJsonResume(resume, { includePhoto: jsonResumeIncludePhoto });
            report = converted.report;
            await deliverFile(textBlob(`${JSON.stringify(converted.document, null, 2)}\n`, format), `resume-${baseName}.jsonresume.json`);
            break;
        }
        case "pdf":
            if (pdfIncludeSidecar) {
                if (encryptionKey) {
                    await exportToEncryptedJson(
                        resume,
                        encryptionKey,
                        `resume-${baseName}.encrypted.json`,
                        messages,
                    );
                } else {
                    exportToJson(resume, `resume-${baseName}.json`);
                }
            }
            await triggerPdfPrint(paperSize, `resume-${baseName}.pdf`, messages);
            break;
        case "html":
            await exportToHtml(paperSize, `resume-${baseName}.html`);
            break;
        case "png":
            await exportToPng(`resume-${baseName}.png`);
            break;
        case "svg":
            await exportToSvg(`resume-${baseName}.svg`);
            break;
        case "md":
            await deliverFile(textBlob(toMarkdown(toDocumentModel(resume)), format), `resume-${baseName}.md`);
            break;
        case "txt":
            await deliverFile(textBlob(toPlainText(toDocumentModel(resume)), format), `resume-${baseName}.txt`);
            break;
        case "docx": {
            const { buildDocx } = await loadDocxExporter();
            const { blob, photoSkipped } = await buildDocx(toDocumentModel(resume), {
                style: {
                    fontFamily: resume.settings.typography.fontFamily,
                    accent: resume.settings.colors.accent,
                    text: resume.settings.colors.text,
                    paperSize,
                },
                includePhoto: docxIncludePhoto,
            });
            if (photoSkipped) notices.push("docxPhotoSkipped");
            await deliverFile(blob, `resume-${baseName}.docx`);
            break;
        }
        default: {
            const unknown: never = format;
            throw new Error(`Unknown export format: ${String(unknown)}`);
        }
    }

    return { notices, ...(report ? { report } : {}) };
}
