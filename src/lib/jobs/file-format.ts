import { z } from "zod";
import { MAX_AUTHORING_TEXT_BYTES, repairJsonText } from "@/lib/agent/authoring/parse-text";
import { checkFormat, parseFormat } from "@/lib/workspace/format-version";
import type { DocReason } from "@/lib/workspace/types";
import { portableJobApplicationSchema, type JobApplication } from "./schema";

/**
 * The workspace file of one tracked job: `format`, then the whole application with ISO timestamps. It is a
 * whole-record format: every list must be present (an omitted list is an error, never "empty it"). The
 * local revision counter is bookkeeping of this browser and never written. Recorded copies are referenced
 * by id and hash only; their contents never appear here.
 */

export const APPLICATION_FORMAT = "enginecv.application/v1";

const fileSchema = portableJobApplicationSchema;

/** The canonical text the app writes: stable key order (the schema's), two-space indent, newline at the end. */
export function applicationFileText(application: JobApplication): string {
    const portable: Record<string, unknown> = { format: APPLICATION_FORMAT, ...z.encode(fileSchema, application) };
    delete portable.revision;
    return `${JSON.stringify(portable, null, 2)}\n`;
}

export type ApplicationParseResult =
    | { ok: true; application: Omit<JobApplication, "revision">; id: string | null }
    | { ok: false; reason: DocReason };

/** Validates application file text. Never throws; a bad file is `{ ok: false }` and changes nothing. */
export function parseApplicationText(text: string): ApplicationParseResult {
    const repaired = repairJsonText(text, { maxBytes: MAX_AUTHORING_TEXT_BYTES });
    if (repaired.status === "blocked") return { ok: false, reason: { code: repaired.error.code, line: repaired.error.line, column: repaired.error.column } };
    const value = repaired.value;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return { ok: false, reason: { code: "no-document" } };
    const document = value as Record<string, unknown>;
    // Unlike CVs and letters, the format is required: a job file is never written by hand from scratch.
    if (document.format === undefined) return { ok: false, reason: { code: "no-document", detail: "format" } };
    const format = checkFormat(document.format, parseFormat(APPLICATION_FORMAT)!);
    if (!format.ok) return { ok: false, reason: format.reason };
    const id = typeof document.id === "string" ? document.id : null;

    const rest: Record<string, unknown> = { ...document };
    delete rest.format;
    // Revision 1 stands in for the local counter so the shared schema can be used; the codec replaces it.
    const parsed = z.safeDecode(fileSchema, { ...rest, revision: 1 } as z.input<typeof fileSchema>);
    if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return { ok: false, reason: { code: "invalid-field", detail: issue ? issue.path.join(".") || issue.message : undefined } };
    }
    const application: Omit<JobApplication, "revision"> & { revision?: number } = { ...parsed.data };
    delete application.revision;
    return { ok: true, application, id };
}
