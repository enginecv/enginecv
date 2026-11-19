import type { DirectoryAdapter } from "./directory-adapter";
import { MACHINE_DIR } from "./agent-files";
import { addActivity } from "./workspace-store";
import type { ActivityKind, DocKind, ReasonCode, WorkspaceActivityRecord } from "./types";

/**
 * What the workspace accepted, refused or held for review, recorded three ways: in the activity
 * table (the app's list, with undo), in `.enginecv/log.ndjson` and, for a refusal, in
 * `.enginecv/results/` so an agent can read why and fix the file. Every one of them carries reason
 * codes, counts, paths and ids only, never document text or entry titles (spec FR-050).
 */

export const LOG_FILE = "log.ndjson";
export const LOG_CAP = 500;
const RESULTS_DIR = `${MACHINE_DIR}/results`;

export interface ActivityInput {
    docId: string | null;
    kind: ActivityKind;
    code: ReasonCode;
    detail?: string;
    restoreId?: number | null;
    restoreKind?: DocKind | null;
    now?: number;
}

export async function recordActivity(input: ActivityInput): Promise<number> {
    const entry: Omit<WorkspaceActivityRecord, "id"> = {
        at: input.now ?? Date.now(),
        docId: input.docId,
        kind: input.kind,
        reason: { code: input.code, ...(input.detail ? { detail: input.detail } : {}) },
        restoreId: input.restoreId ?? null,
        restoreKind: input.restoreKind ?? null,
    };
    return addActivity(entry);
}

export interface LogLine {
    at: number;
    doc: string | null;
    file?: string | null;
    outcome: ActivityKind;
    code?: ReasonCode;
    line?: number;
    column?: number;
    detail?: string;
}

/** Appends one line to the log, keeping the newest `LOG_CAP` lines. */
export async function appendLog(adapter: DirectoryAdapter, line: LogLine): Promise<void> {
    const existing = (await adapter.readText(MACHINE_DIR, LOG_FILE)) ?? "";
    const lines = existing.split("\n").filter(Boolean);
    lines.push(JSON.stringify({ ...line, at: new Date(line.at).toISOString() }));
    await adapter.writeText(MACHINE_DIR, LOG_FILE, `${lines.slice(-LOG_CAP).join("\n")}\n`);
}

const resultName = (docId: string) => `${docId}.refused.json`;

/** Tells an agent why a file was refused, in one small file it can read: code, place in the file, path. */
export async function writeRefusal(adapter: DirectoryAdapter, input: { docId: string; file: string | null; code: ReasonCode; line?: number; column?: number; detail?: string; now?: number }): Promise<void> {
    const body = { doc: input.docId, file: input.file, refused: true, code: input.code, ...(input.line ? { line: input.line } : {}), ...(input.column ? { column: input.column } : {}), ...(input.detail ? { field: input.detail } : {}), at: new Date(input.now ?? Date.now()).toISOString() };
    await adapter.writeText(RESULTS_DIR, resultName(input.docId), `${JSON.stringify(body)}\n`);
}

/** The file is fine again: the refusal note is no longer true. */
export async function clearRefusal(adapter: DirectoryAdapter, docId: string): Promise<void> {
    await adapter.remove(RESULTS_DIR, resultName(docId));
}
