import { appendLog, recordActivity } from "./activity";
import type { DirectoryAdapter } from "./directory-adapter";
import { ExportUnavailableError, produceExport, type ProducedExport } from "./export-runner";
import { nameKey } from "./names";
import {
    EXPORTS_DIR,
    INCOMPLETE_GRACE_MS,
    REQUESTS_DIR,
    REQUEST_EXPIRY_MS,
    RESULTS_DIR,
    RESULT_SUFFIX,
    checkRequest,
    cleanupPlan,
    exportFileName,
    failure,
    formatsFor,
    requestIdOf,
    resolveTarget,
    resultName,
    success,
    writeResult,
    type ExportRequest,
    type RequestErrorCode,
} from "./requests";
import type { ReasonCode } from "./types";
import { listDocRows } from "./workspace-store";

/**
 * Handles the export requests an agent left in `.enginecv/requests/`. Every request ends in exactly
 * one result file (never none, never two), is recorded in the activity list and the log with codes
 * only, and never overwrites a file in `exports/` that EngineCV did not write.
 */

/** A pass handles a few requests, so a burst of heavy exports never stalls the page; the rest wait for the next pass. */
export const REQUESTS_PER_PASS = 3;

export interface ProcessorDeps {
    adapter: DirectoryAdapter;
    now?: () => number;
    produce?: (input: { kind: "cv" | "letter"; docId: string; format: string; paper?: "a4" | "letter" }) => Promise<ProducedExport>;
    /** A request was answered (for a notification). */
    onAnswered?: (info: { docId: string | null; ok: boolean; format: string | null; agent: string | null; file?: string; code?: string }) => void;
}

export interface ProcessOutcome {
    handled: number;
    waiting: number;
}

/** File names EngineCV wrote into `exports/` before, read from the success results it left. */
async function appWrittenExports(adapter: DirectoryAdapter): Promise<Set<string>> {
    const written = new Set<string>();
    for (const file of await adapter.listFiles(RESULTS_DIR)) {
        if (!file.name.endsWith(RESULT_SUFFIX)) continue;
        try {
            const body = JSON.parse((await adapter.readText(RESULTS_DIR, file.name)) ?? "null") as { ok?: boolean; file?: string } | null;
            if (body?.ok && typeof body.file === "string" && body.file.startsWith(`${EXPORTS_DIR}/`)) written.add(nameKey(body.file.slice(EXPORTS_DIR.length + 1)));
        } catch {
            // An unreadable result is simply not evidence that the app wrote that file.
        }
    }
    return written;
}

async function answer(deps: ProcessorDeps, request: { id: string; docId: string | null; agent?: string; format?: string }, outcome: { ok: true; file: string; bytes: number } | { ok: false; code: RequestErrorCode; message: string }): Promise<void> {
    const now = (deps.now ?? Date.now)();
    deps.onAnswered?.({ docId: request.docId, ok: outcome.ok, format: request.format ?? null, agent: request.agent ?? null, ...(outcome.ok ? { file: outcome.file } : { code: outcome.code }) });
    if (outcome.ok) {
        await writeResult(deps.adapter, success(request.id, outcome.file, outcome.bytes, now));
        await recordActivity({ docId: request.docId, kind: "accepted", code: "exported", detail: outcome.file, now });
        await appendLog(deps.adapter, { at: now, doc: request.docId, file: outcome.file, outcome: "accepted", code: "exported" }).catch(() => undefined);
    } else {
        await writeResult(deps.adapter, failure(request.id, outcome.code, outcome.message, now));
        await recordActivity({ docId: request.docId, kind: "refused", code: outcome.code as ReasonCode, now });
        await appendLog(deps.adapter, { at: now, doc: request.docId, file: null, outcome: "refused", code: outcome.code as ReasonCode }).catch(() => undefined);
    }
}

/** Runs one valid request: finds the document, makes the export, writes it into `exports/` and answers. Exported so in-browser tools use the same path. */
export async function handleExportRequest(deps: ProcessorDeps, request: ExportRequest, written?: Set<string>): Promise<void> {
    return handle(deps, request, written ?? (await appWrittenExports(deps.adapter)));
}

async function handle(deps: ProcessorDeps, request: ExportRequest, written: Set<string>): Promise<void> {
    const rows = await listDocRows();
    const row = resolveTarget(request.target, rows);
    if (!row) {
        await answer(deps, { id: request.id, docId: null, agent: request.agent, format: request.format }, { ok: false, code: "unknown-document", message: `Unknown target ${request.target}. Read .enginecv/index.json for ids.` });
        return;
    }
    const ctx = { id: request.id, docId: row.docId, agent: request.agent, format: request.format };
    if (!formatsFor(row.kind).includes(request.format)) {
        await answer(deps, ctx, { ok: false, code: "format-unavailable", message: `A ${row.kind === "cv" ? "CV" : "letter"} cannot be exported as ${request.format}. Use one of: ${formatsFor(row.kind).join(", ")}. For PDF request html and follow .enginecv/reference/exports.md.` });
        return;
    }
    try {
        const made = await (deps.produce ?? produceExport)({ kind: row.kind, docId: row.docId, format: request.format, paper: request.paper });
        // A name the app did not write is never replaced: such a clash takes a -2 suffix.
        const taken = new Set((await deps.adapter.listFiles(EXPORTS_DIR)).map((file) => nameKey(file.name)).filter((key) => !written.has(key)));
        const name = exportFileName(made.stem, made.extension, taken);
        if (typeof made.body === "string") await deps.adapter.writeText(EXPORTS_DIR, name, made.body);
        else await deps.adapter.writeBytes(EXPORTS_DIR, name, made.body);
        written.add(nameKey(name));
        const bytes = typeof made.body === "string" ? new TextEncoder().encode(made.body).length : made.body.length;
        await answer(deps, ctx, { ok: true, file: `${EXPORTS_DIR}/${name}`, bytes });
    } catch (error) {
        if (error instanceof ExportUnavailableError) await answer(deps, ctx, { ok: false, code: error.reason, message: error.message });
        else if ((error as { code?: string })?.code === "permission") await answer(deps, ctx, { ok: false, code: "permission", message: "EngineCV may not write to the folder right now." });
        else if ((error as { code?: string })?.code === "busy") await answer(deps, ctx, { ok: false, code: "file-busy", message: "The export file is in use by another program. Ask again in a moment." });
        else {
            // The cause goes to the console only (never into the result file), so a failed export can be diagnosed.
            console.error("[EngineCV workspace] export failed:", error instanceof Error ? `${error.name}: ${error.message}` : error);
            await answer(deps, ctx, { ok: false, code: "export-failed", message: "The export could not be made. Open the browser console for the reason." });
        }
    }
}

/** One pass over `.enginecv/requests/`. Safe to call often: handled requests are skipped, unfinished ones wait. */
export async function processRequests(deps: ProcessorDeps): Promise<ProcessOutcome> {
    const now = (deps.now ?? Date.now)();
    const files = (await deps.adapter.listFiles(REQUESTS_DIR)).filter((file) => requestIdOf(file.name) !== null);
    if (files.length === 0) return { handled: 0, waiting: 0 };
    const answered = new Set((await deps.adapter.listFiles(RESULTS_DIR)).map((file) => file.name));
    const open = files.filter((file) => !answered.has(resultName(requestIdOf(file.name)!)));

    let handled = 0;
    let waiting = 0;
    let written: Set<string> | null = null;
    for (const file of open) {
        if (handled >= REQUESTS_PER_PASS) {
            waiting += 1;
            continue;
        }
        const id = requestIdOf(file.name)!;
        const text = await deps.adapter.readText(REQUESTS_DIR, file.name);
        if (text === null) continue;
        // Never run late: a request that sat unhandled this long (the app was closed) is answered, not executed.
        if (now - file.lastModified > REQUEST_EXPIRY_MS) {
            await answer(deps, { id, docId: null }, { ok: false, code: "request-expired", message: "The request was not handled in time (EngineCV was not open). Make a new request." });
            handled += 1;
            continue;
        }
        const checked = checkRequest(id, text);
        if (!checked.ok) {
            // A file still being written is given a moment before it is called invalid.
            if (checked.incomplete && now - file.lastModified < INCOMPLETE_GRACE_MS) {
                waiting += 1;
                continue;
            }
            await answer(deps, { id, docId: null }, { ok: false, code: checked.code, message: checked.message });
            handled += 1;
            continue;
        }
        written ??= await appWrittenExports(deps.adapter);
        await handle(deps, checked.request, written);
        handled += 1;
    }

    // Housekeeping: old request files and surplus results.
    const plan = cleanupPlan(files, await deps.adapter.listFiles(RESULTS_DIR), now);
    for (const name of plan.requests) await deps.adapter.remove(REQUESTS_DIR, name).catch(() => undefined);
    for (const name of plan.results) await deps.adapter.remove(RESULTS_DIR, name).catch(() => undefined);
    return { handled, waiting };
}
