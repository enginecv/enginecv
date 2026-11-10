import { authoringToResume, parseAuthoringText, type Notice } from "@/lib/agent/authoring";
import { importResumeFromJsonText } from "@/lib/export";
import { createId } from "@/lib/id";
import { addLoss, emptyReport, type ConversionReport } from "@/lib/json-resume/report";
import { jsonResumeToResume } from "@/lib/json-resume/to-resume";
import type { Resume } from "@/lib/schema";
import { parseLinkedinArchive } from "./linkedin/archive";
import { LinkedinImportError } from "./linkedin/errors";
import { mapLinkedinToResume } from "./linkedin/map-linkedin-to-resume";
import { EuropassImportError } from "./europass/errors";
import { parseEuropassFile } from "./europass/file";
import { mapEuropassToResume } from "./europass/map-europass-to-resume";
import { readFileText } from "./read-file";
import { detectFileSource, type SourceId } from "./sources";
import type { StagedBatch } from "./staging/types";

export type SourceReadFailure =
    /** No supported format found in the file. */
    | "unsupported"
    /** The file is supported but could not be read. */
    | "unreadable"
    | "linkedin-failure"
    | "europass-failure";

/** A file the hub could not read. `failureClass` carries the reader's own class when there is one. */
export class SourceReadError extends Error {
    readonly code: SourceReadFailure;
    readonly sourceId?: SourceId;
    readonly failureClass?: string;

    constructor(code: SourceReadFailure, options: { sourceId?: SourceId; failureClass?: string } = {}) {
        super(code);
        this.name = "SourceReadError";
        this.code = code;
        this.sourceId = options.sourceId;
        this.failureClass = options.failureClass;
    }
}

export interface ReadSourceHelpers {
    /** Asks for the key of an encrypted file. Return null to cancel. */
    requestDecryptionKey?: (errorMessage?: string | null) => Promise<string | null> | string | null;
}

/** Authoring notices that mean something was dropped, as a loss report. */
export function noticesToReport(notices: Notice[]): ConversionReport {
    const report = emptyReport();
    for (const notice of notices) {
        if (notice.kind === "skipped") addLoss(report, "left-out", "invalid-values-skipped", "", 1);
    }
    return report;
}

function batch(sourceId: SourceId, label: string, resume: Resume, losses?: ConversionReport): StagedBatch {
    return { id: createId(), sourceId, label, resume, ...(losses && losses.items.length > 0 ? { losses } : {}) };
}

/** An AI answer or authoring file as a staged batch. */
export function readAuthoringText(text: string, label: string, sourceId: SourceId = "authoring"): StagedBatch {
    const parsed = parseAuthoringText(text);
    if (parsed.status !== "ok") throw new SourceReadError("unreadable", { sourceId });
    const converted = authoringToResume(parsed.document);
    return {
        ...batch(sourceId, label, converted.resume, noticesToReport([...parsed.notices, ...converted.notices])),
        authoring: { result: converted, parseNotices: parsed.notices },
    };
}

async function readJson(file: File, sourceId: SourceId, helpers: ReadSourceHelpers): Promise<StagedBatch[]> {
    const text = await readFileText(file);

    if (sourceId === "authoring") return [readAuthoringText(text, file.name)];

    if (sourceId === "jsonresume") {
        const converted = jsonResumeToResume(JSON.parse(text));
        return [batch(sourceId, file.name, converted.resume, converted.report)];
    }

    const result = await importResumeFromJsonText(text, helpers.requestDecryptionKey);
    // null: the person cancelled the key prompt.
    if (!result) return [];
    if (result.kind === "data-export") {
        return result.resumes.map((resume, index) => ({ ...batch(sourceId, `${file.name} (${index + 1})`, resume), fromDataExport: true }));
    }
    if (result.kind === "json-resume") return [batch("jsonresume", file.name, result.resume, result.report)];
    return [batch(sourceId, file.name, result.resume)];
}

/**
 * Reads one dropped file into staged batches with the existing readers.
 * Most files give one batch; a "Download my data" file gives one per CV.
 * An empty list means the person cancelled (an encrypted file's key prompt).
 */
export async function readSourceFile(file: File, helpers: ReadSourceHelpers = {}): Promise<StagedBatch[]> {
    const sourceId = await detectFileSource(file);
    if (!sourceId) throw new SourceReadError("unsupported");

    try {
        if (sourceId === "linkedin") {
            const parsed = await parseLinkedinArchive([file]);
            return [batch(sourceId, file.name, mapLinkedinToResume(parsed))];
        }
        if (sourceId === "europass") {
            const parsed = await parseEuropassFile(file);
            return [batch(sourceId, file.name, mapEuropassToResume(parsed.cv))];
        }
        return await readJson(file, sourceId, helpers);
    } catch (error) {
        if (error instanceof SourceReadError) throw error;
        if (error instanceof LinkedinImportError) {
            throw new SourceReadError("linkedin-failure", { sourceId, failureClass: error.failureClass });
        }
        if (error instanceof EuropassImportError) {
            throw new SourceReadError("europass-failure", { sourceId, failureClass: error.failureClass });
        }
        throw new SourceReadError("unreadable", { sourceId });
    }
}
