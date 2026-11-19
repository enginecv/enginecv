import { exportToHtml, triggerPdfPrint, type ExportMessages } from "@/lib/export";
import { getExportFormat, type ResumeExportFormat } from "@/lib/export-formats";
import { ExportModuleLoadError, type ResumeExportNotice } from "@/lib/resume-export";
import { deliverFile } from "@/lib/share";
import { toLetterLatex } from "./export-latex";
import { toLetterMarkdown, toLetterPlainText } from "./export-text";
import { letterFileBaseName } from "./file-name";
import type { ResolvedLetter } from "./resolve";

/**
 * The formats a letter can be exported as: the CV's list, minus the ones that hold CV data (the
 * JSON formats). The dialog, the format descriptions and their translations come from the same
 * registry as the CV's, so the two exports stay one flow.
 */
export const LETTER_EXPORT_FORMATS: readonly ResumeExportFormat[] = ["pdf", "html", "docx", "md", "txt", "tex"];

export interface RunLetterExportOptions {
    letter: ResolvedLetter;
    format: ResumeExportFormat;
    docxIncludePhoto?: boolean;
    messages?: Partial<ExportMessages>;
}

export interface RunLetterExportResult {
    notices: ResumeExportNotice[];
    /** Fonts the HTML export could not embed (they fall back to a generic family). */
    fallbackFonts?: string[];
}

/** Imports the letter's Word builder on demand so the `docx` library stays out of the editor bundle. */
export function loadLetterDocxExporter() {
    return import("./export-docx").catch((error: unknown) => {
        throw new ExportModuleLoadError(error);
    });
}

/** Same shape as `runResumeExport`: it delivers the file and reports what the dialog should say afterwards. */
export async function runLetterExport({ letter, format, docxIncludePhoto = false, messages }: RunLetterExportOptions): Promise<RunLetterExportResult> {
    const base = letterFileBaseName(letter);
    const notices: ResumeExportNotice[] = [];
    let fallbackFonts: string[] | undefined;
    const textBlob = (content: string) => new Blob([content], { type: getExportFormat(format).mimeType });

    switch (format) {
        case "pdf":
            await triggerPdfPrint(letter.paperSize, `${base}.pdf`, messages);
            break;
        case "html": {
            const fonts = await exportToHtml(letter.paperSize, `${base}.html`);
            if (fonts.length > 0) {
                notices.push("htmlFontFallback");
                fallbackFonts = fonts;
            }
            break;
        }
        case "md":
            await deliverFile(textBlob(toLetterMarkdown(letter)), `${base}.md`);
            break;
        case "txt":
            await deliverFile(textBlob(toLetterPlainText(letter)), `${base}.txt`);
            break;
        case "tex":
            await deliverFile(textBlob(toLetterLatex(letter)), `${base}.tex`);
            break;
        case "docx": {
            const { buildLetterDocx } = await loadLetterDocxExporter();
            const { blob, photoSkipped } = await buildLetterDocx(letter, { includePhoto: docxIncludePhoto });
            if (photoSkipped) notices.push("docxPhotoSkipped");
            await deliverFile(blob, `${base}.docx`);
            break;
        }
        default:
            throw new Error(`A letter cannot be exported as ${format}.`);
    }
    return { notices, ...(fallbackFonts ? { fallbackFonts } : {}) };
}
