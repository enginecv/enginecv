import { MACHINE_DIR } from "./agent-files";
import type { DirectoryAdapter } from "./directory-adapter";
import { nameKey } from "./names";
import type { DocKind, WorkspaceDocRecord } from "./types";

/**
 * Export requests an agent leaves in `.enginecv/requests/` and the answers EngineCV leaves in
 * `.enginecv/results/` (see `contracts/requests-results.md`). This file is the protocol: checking a
 * request, finding its document, naming the output and answering. Producing the export itself is
 * `export-runner.ts`.
 */

export const REQUESTS_DIR = `${MACHINE_DIR}/requests`;
export const RESULTS_DIR = `${MACHINE_DIR}/results`;
export const EXPORTS_DIR = "exports";
export const REQUEST_SUFFIX = ".request.json";
export const RESULT_SUFFIX = ".result.json";

/** A request nobody handled this long after it was written is answered `request-expired`, never run late. */
export const REQUEST_EXPIRY_MS = 10 * 60 * 1000;
/** Processed request files are removed after a day; results are kept up to this many. */
export const REQUEST_KEEP_MS = 24 * 60 * 60 * 1000;
export const RESULTS_CAP = 200;
/** A request file that still does not parse this long after its last write is answered as invalid. */
export const INCOMPLETE_GRACE_MS = 3_000;

export type RequestErrorCode = "request-invalid" | "request-expired" | "unknown-document" | "format-unavailable" | "permission" | "file-busy" | "export-failed";

export const CV_FORMATS = ["html", "docx", "md", "txt", "tex", "json"] as const;
export const LETTER_FORMATS = ["html", "docx", "md", "txt", "tex"] as const;
export type ExportRequestFormat = (typeof CV_FORMATS)[number];

export const formatsFor = (kind: DocKind): readonly string[] => (kind === "cv" ? CV_FORMATS : LETTER_FORMATS);
export const extensionFor = (format: string) => (format === "tex" ? "tex" : format);

export interface ExportRequest {
    id: string;
    action: "export";
    target: string;
    format: ExportRequestFormat;
    paper?: "a4" | "letter";
}

export type RequestCheck = { ok: true; request: ExportRequest } | { ok: false; code: RequestErrorCode; message: string; incomplete?: boolean };

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** The request id a file name carries, or null when it is not a request file. */
export function requestIdOf(fileName: string): string | null {
    if (!fileName.endsWith(REQUEST_SUFFIX)) return null;
    const id = fileName.slice(0, -REQUEST_SUFFIX.length);
    return ID_PATTERN.test(id) ? id : null;
}

/** Checks request text. A file that is not complete JSON yet is `incomplete`: the caller waits a moment before answering. */
export function checkRequest(fileId: string, text: string): RequestCheck {
    if (text.trim() === "") return { ok: false, code: "request-invalid", message: "The request file is empty.", incomplete: true };
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch {
        return { ok: false, code: "request-invalid", message: "The request is not complete JSON. Write the whole file in one save.", incomplete: true };
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) return { ok: false, code: "request-invalid", message: "The request must be a JSON object." };
    const body = value as Record<string, unknown>;
    if (body.id !== fileId) return { ok: false, code: "request-invalid", message: `"id" must be ${fileId}, the same as the file name.` };
    if (body.action !== "export") return { ok: false, code: "request-invalid", message: `Unknown action. Only "export" is supported.` };
    if (typeof body.target !== "string" || body.target.trim() === "") return { ok: false, code: "request-invalid", message: `"target" must be a document id from .enginecv/index.json or its file path.` };
    if (typeof body.format !== "string") return { ok: false, code: "request-invalid", message: `"format" is required: ${CV_FORMATS.join(", ")}.` };
    if (body.paper !== undefined && body.paper !== "a4" && body.paper !== "letter") return { ok: false, code: "request-invalid", message: `"paper" must be "a4" or "letter".` };
    return { ok: true, request: { id: fileId, action: "export", target: body.target.trim(), format: body.format as ExportRequestFormat, ...(body.paper ? { paper: body.paper as "a4" | "letter" } : {}) } };
}

/** The document a target names: by id, or by its file path (`cvs/Name.cv.json`). */
export function resolveTarget(target: string, rows: readonly WorkspaceDocRecord[]): WorkspaceDocRecord | null {
    const byId = rows.find((row) => row.docId === target);
    if (byId) return byId;
    const path = target.replace(/\\/g, "/").replace(/^\.?\//, "");
    return rows.find((row) => row.fileName && nameKey(`${row.kind === "cv" ? "cvs" : "letters"}/${row.fileName}`) === nameKey(path)) ?? null;
}

/** A name for the export that is not taken, with `-2`, `-3` ... before the extension when it is. */
export function exportFileName(stem: string, extension: string, taken: ReadonlySet<string>): string {
    const clean = stem.replace(/[\\/:*?"<>|]|\p{Cc}/gu, "").replace(/\s+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 80) || "export";
    let name = `${clean}.${extension}`;
    for (let n = 2; taken.has(nameKey(name)); n += 1) name = `${clean}-${n}.${extension}`;
    return name;
}

export type RequestResult =
    | { id: string; ok: true; file: string; bytes: number; at: string }
    | { id: string; ok: false; error: { code: RequestErrorCode; message: string }; at: string };

export const resultName = (id: string) => `${id}${RESULT_SUFFIX}`;

/** Writes the answer in one piece, so an agent never reads half of it. */
export async function writeResult(adapter: DirectoryAdapter, result: RequestResult): Promise<void> {
    await adapter.writeText(RESULTS_DIR, resultName(result.id), `${JSON.stringify(result)}\n`);
}

export const failure = (id: string, code: RequestErrorCode, message: string, now: number = Date.now()): RequestResult => ({ id, ok: false, error: { code, message }, at: new Date(now).toISOString() });
export const success = (id: string, file: string, bytes: number, now: number = Date.now()): RequestResult => ({ id, ok: true, file, bytes, at: new Date(now).toISOString() });

/** What to remove: request files older than a day, and the oldest results beyond the cap. */
export function cleanupPlan(requests: ReadonlyArray<{ name: string; lastModified: number }>, results: ReadonlyArray<{ name: string; lastModified: number }>, now: number): { requests: string[]; results: string[] } {
    const staleRequests = requests.filter((file) => now - file.lastModified > REQUEST_KEEP_MS).map((file) => file.name);
    const newestFirst = [...results].sort((a, b) => b.lastModified - a.lastModified);
    return { requests: staleRequests, results: newestFirst.slice(RESULTS_CAP).map((file) => file.name) };
}
