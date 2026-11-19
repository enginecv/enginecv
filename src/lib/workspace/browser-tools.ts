import { db } from "@/lib/db";
import { sectionCounts } from "@/lib/linked-file/apply-content";
import { hashText } from "@/lib/linked-file/hash";
import { letterDocumentSchema } from "@/lib/letters/schema";
import { parseCv } from "@/lib/letters/store";
import { recordActivity } from "./activity";
import { readAppDocuments } from "./apply-stored";
import { createCvCodec } from "./codecs/cv";
import { createLetterCodec } from "./codecs/letter";
import { createCvBinding, type DocBinding } from "./cv-binding";
import type { DirectoryAdapter } from "./directory-adapter";
import { handleExportRequest } from "./request-processor";
import { CV_FORMATS, LETTER_FORMATS, type ExportRequest } from "./requests";
import { checkShrink, pendingReviewFor, removedEntryTitles } from "./shrink-guard";
import { createLetterBinding } from "./letter-binding";
import { cvTitle, letterTitle } from "./titles";
import type { DocKind, ReasonCode } from "./types";
import { getWorkspace } from "./workspace-store";

/**
 * Optional tools for an assistant running inside the browser (WebMCP: `navigator.modelContext`). They
 * go through the very same checks as a file change: the file format's own validation, the restore point
 * before a change, the shrink check, the activity list. Where the browser has no such API, or the person
 * has not turned this on, nothing happens: no UI, no work, no error. Off by default.
 */

export const BROWSER_TOOLS_KEY = "enginecv.browserTools";
export const BROWSER_TOOLS_EVENT = "enginecv:browser-tools-changed";

export function isBrowserToolsEnabled(): boolean {
    try {
        return typeof localStorage !== "undefined" && localStorage.getItem(BROWSER_TOOLS_KEY) === "1";
    } catch {
        return false;
    }
}

export function setBrowserToolsEnabled(on: boolean): void {
    try {
        if (on) localStorage.setItem(BROWSER_TOOLS_KEY, "1");
        else localStorage.removeItem(BROWSER_TOOLS_KEY);
    } catch {
        // Storage blocked: the setting simply does not stick.
    }
    if (typeof window !== "undefined") window.dispatchEvent(new Event(BROWSER_TOOLS_EVENT));
}

/** The shape of the browser API this module needs; anything else is ignored. */
export interface ModelContextTool {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    execute: (input: Record<string, unknown>) => Promise<unknown>;
}
export interface ModelContextLike {
    registerTool?: (tool: ModelContextTool) => unknown;
    unregisterTool?: (name: string) => unknown;
}

/** `document.modelContext`, then `navigator.modelContext`; null when the browser offers neither. */
export function detectModelContext(): ModelContextLike | null {
    if (typeof document !== "undefined") {
        const found = (document as unknown as { modelContext?: ModelContextLike }).modelContext;
        if (found && typeof found.registerTool === "function") return found;
    }
    if (typeof navigator !== "undefined") {
        const found = (navigator as unknown as { modelContext?: ModelContextLike }).modelContext;
        if (found && typeof found.registerTool === "function") return found;
    }
    return null;
}

export const isBrowserToolsSupported = () => detectModelContext() !== null;

type ToolResult = { ok: true; [key: string]: unknown } | { ok: false; code: ReasonCode | "needs-folder" | "request-invalid"; message: string };

const refuse = (code: Extract<ToolResult, { ok: false }>["code"], message: string): ToolResult => ({ ok: false, code, message });

interface Deps {
    /** The connected workspace folder's adapter, or null (list, read and change work without one; export needs it). */
    getAdapter: () => DirectoryAdapter | null;
}

async function hideContactOn(): Promise<boolean> {
    return (await getWorkspace())?.hideContact ?? false;
}

async function kindOf(id: string): Promise<DocKind | null> {
    if (await db.resumes.where("id").equals(id).count()) return "cv";
    if (await db.coverLetters.where("id").equals(id).count()) return "letter";
    return null;
}

async function listDocuments(): Promise<ToolResult> {
    const docs = await readAppDocuments();
    return {
        ok: true,
        cvs: docs.cvs.map((cv) => ({ id: cv.id, title: cvTitle(cv), lang: cv.settings.language || "en", updated: new Date(cv.updatedAt).toISOString(), entries: sectionCounts(cv) })),
        letters: docs.letters.map((letter) => ({ id: letter.id, title: letterTitle(letter), cv: letter.cvId, company: letter.company, role: letter.role, status: letter.status, updated: new Date(letter.updatedAt).toISOString() })),
    };
}

async function readDocument(input: Record<string, unknown>): Promise<ToolResult> {
    const id = typeof input.id === "string" ? input.id : "";
    const kind = id ? await kindOf(id) : null;
    if (!kind) return refuse("unknown-document", `Unknown document ${id || "(no id)"}. Call list_documents for ids.`);
    const hideContact = await hideContactOn();
    if (kind === "cv") {
        const cv = parseCv(await db.resumes.get(id));
        if (!cv) return refuse("unknown-document", "That CV could not be read.");
        const text = createCvCodec().serialize(cv, { hideContact });
        if (typeof input.section === "string" && input.section) {
            const part = (JSON.parse(text) as Record<string, unknown>)[input.section];
            if (part === undefined) return refuse("request-invalid", `This CV has no "${input.section}" section.`);
            return { ok: true, id, kind, section: input.section, content: JSON.stringify(part, null, 2), hash: hashText(text) };
        }
        return { ok: true, id, kind, content: text, hash: hashText(text) };
    }
    const row = await db.coverLetters.get(id);
    const parsed = row ? letterDocumentSchema.safeParse(row) : null;
    if (!parsed?.success) return refuse("unknown-document", "That letter could not be read.");
    const text = createLetterCodec().serialize(parsed.data, { hideContact });
    return { ok: true, id, kind, content: text, hash: hashText(text) };
}

/** A whole document as file text, put through the same validation, restore point and shrink check as a file change. */
async function applyChange(input: Record<string, unknown>): Promise<ToolResult> {
    const id = typeof input.id === "string" ? input.id : "";
    const content = typeof input.content === "string" ? input.content : "";
    const kind = id ? await kindOf(id) : null;
    if (!kind) return refuse("unknown-document", `Unknown document ${id || "(no id)"}. Call list_documents for ids.`);
    const hideContact = await hideContactOn();
    const now = Date.now();
    const log = (kindOfEntry: "accepted" | "refused" | "review", code: ReasonCode, detail?: string, restoreId?: number | null) => recordActivity({ docId: id, kind: kindOfEntry, code, detail, restoreId: restoreId ?? null, restoreKind: kind, now }).catch(() => undefined);

    // The same bindings the folder engines use: an open editor is changed through its store, a closed document through the database.
    const binding = (kind === "cv" ? await createCvBinding(id) : await createLetterBinding(id)) as DocBinding<unknown> | null;
    if (!binding) return refuse("unknown-document", "That document could not be opened.");
    try {
        await binding.flushLocal();
        if (kind === "cv") {
            const codec = createCvCodec();
            const parsed = codec.parse(content, { now, hideContact });
            if (!parsed.ok) {
                await log("refused", parsed.reason.code, parsed.reason.detail);
                return refuse(parsed.reason.code, `The content was not accepted (${parsed.reason.code}${parsed.reason.line ? ` at line ${parsed.reason.line}` : ""}). Nothing was changed.`);
            }
            const before = binding.getDoc() as ReturnType<typeof codec.apply>;
            const verdict = checkShrink(codec.entryCount(before), codec.entryCount(parsed.doc));
            if (verdict.triggered) {
                const held = pendingReviewFor(verdict, removedEntryTitles(before, parsed.doc).titles, now);
                await log("review", "shrink-guard", `${held.keptCount} of ${held.previousCount} kept`);
                return refuse("shrink-guard", `This would remove ${verdict.removedCount} entries and keep ${verdict.keptCount} of ${verdict.previousCount}. Nothing was changed. Send the full document with the entries you were not asked to remove.`);
            }
            const next = codec.apply(before, parsed.doc, { hideContact });
            if (codec.isSameContent(before, next)) return { ok: true, changed: false };
            const restoreId = await binding.snapshot(before);
            binding.applyIncoming(() => next);
        await binding.flushLocal();
            await binding.flushLocal();
            await log("accepted", "applied", undefined, typeof restoreId === "number" ? restoreId : null);
            return { ok: true, changed: true, notices: parsed.notices.length };
        }
        const codec = createLetterCodec();
        const parsed = codec.parse(content, { now, hideContact });
        if (!parsed.ok) {
            await log("refused", parsed.reason.code, parsed.reason.detail);
            return refuse(parsed.reason.code, `The content was not accepted (${parsed.reason.code}). Nothing was changed.`);
        }
        const before = binding.getDoc() as Parameters<typeof codec.apply>[0];
        const allowed = codec.canApplyExternal(before);
        if (!allowed.ok) {
            await log("refused", allowed.reason.code);
            return refuse(allowed.reason.code, "A sent letter cannot be changed. Create a new letter instead.");
        }
        const next = codec.apply(before, parsed.doc, { hideContact });
        const verdict = checkShrink(codec.entryCount(before), codec.entryCount(next));
        if (verdict.triggered) {
            await log("review", "shrink-guard", `${verdict.keptCount} of ${verdict.previousCount} kept`);
            return refuse("shrink-guard", `This would remove ${verdict.removedCount} paragraphs. Nothing was changed.`);
        }
        if (codec.isSameContent(before, next)) return { ok: true, changed: false };
        const restoreId = await binding.snapshot(before);
        binding.applyIncoming(() => next);
        await binding.flushLocal();
        await log("accepted", "applied", undefined, typeof restoreId === "number" ? restoreId : null);
        return { ok: true, changed: true, notices: parsed.notices.length };
    } finally {
        binding.dispose();
    }
}

async function requestExport(input: Record<string, unknown>, deps: Deps): Promise<ToolResult> {
    const adapter = deps.getAdapter();
    if (!adapter) return refuse("needs-folder", "Exports are written into a workspace folder. Ask the person to connect one in EngineCV.");
    const id = typeof input.id === "string" ? input.id : "";
    const kind = id ? await kindOf(id) : null;
    if (!kind) return refuse("unknown-document", `Unknown document ${id || "(no id)"}. Call list_documents for ids.`);
    const format = typeof input.format === "string" ? input.format : "";
    if (!(kind === "cv" ? CV_FORMATS : LETTER_FORMATS).includes(format as never)) return refuse("format-unavailable", `Use one of: ${(kind === "cv" ? CV_FORMATS : LETTER_FORMATS).join(", ")}.`);
    const requestId = `tool-${now36()}`;
    const request: ExportRequest = { id: requestId, action: "export", target: id, format: format as ExportRequest["format"], ...(input.paper === "a4" || input.paper === "letter" ? { paper: input.paper } : {}) };
    await handleExportRequest({ adapter }, request);
    const result = JSON.parse((await adapter.readText(".enginecv/results", `${requestId}.result.json`)) ?? "null") as { ok: boolean; file?: string; bytes?: number; error?: { code: ReasonCode; message: string } } | null;
    if (!result) return refuse("export-failed", "The export did not finish.");
    // The one-off result file is not an agent's to keep.
    await adapter.remove(".enginecv/results", `${requestId}.result.json`).catch(() => undefined);
    return result.ok ? { ok: true, file: result.file, bytes: result.bytes } : refuse(result.error?.code ?? "export-failed", result.error?.message ?? "The export could not be made.");
}

const now36 = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

export function browserTools(deps: Deps): ModelContextTool[] {
    return [
        {
            name: "list_documents",
            description: "List the person's EngineCV CVs and cover letters with ids, titles and sizes. Read this first; it holds no document text.",
            inputSchema: { type: "object", properties: {}, additionalProperties: false },
            execute: () => listDocuments(),
        },
        {
            name: "read_document",
            description: "Read one CV or letter as its file text. For a CV, pass `section` (for example \"projects\") to read only that part and save tokens.",
            inputSchema: { type: "object", properties: { id: { type: "string" }, section: { type: "string" } }, required: ["id"], additionalProperties: false },
            execute: (input) => readDocument(input),
        },
        {
            name: "apply_change",
            description: "Replace a document with new file text (the same JSON the folder files hold). It is validated, a restore point is taken first, and a change that would drop most entries is refused. Keep every entry you were not asked to change.",
            inputSchema: { type: "object", properties: { id: { type: "string" }, content: { type: "string", description: "The whole document as JSON text." } }, required: ["id", "content"], additionalProperties: false },
            execute: (input) => applyChange(input),
        },
        {
            name: "request_export",
            description: "Export a document into the workspace folder's exports/ folder. Formats: CV html docx md txt tex json; letter html docx md txt tex. Needs a connected workspace folder.",
            inputSchema: { type: "object", properties: { id: { type: "string" }, format: { type: "string" }, paper: { type: "string", enum: ["a4", "letter"] } }, required: ["id", "format"], additionalProperties: false },
            execute: (input) => requestExport(input, deps),
        },
    ];
}

let registered: { context: ModelContextLike; names: string[] } | null = null;

/**
 * Registers the tools when the browser supports it and the person turned it on; removes them again when
 * either stops being true. Safe to call any number of times. Returns whether tools are registered.
 */
export function syncBrowserTools(deps: Deps, context: ModelContextLike | null = detectModelContext()): boolean {
    const wanted = !!context && isBrowserToolsEnabled();
    if (registered && (!wanted || registered.context !== context)) {
        for (const name of registered.names) {
            try {
                registered.context.unregisterTool?.(name);
            } catch {
                // Already gone: fine.
            }
        }
        registered = null;
    }
    if (!wanted || registered) return !!registered;
    const tools = browserTools(deps);
    try {
        for (const tool of tools) context!.registerTool!(tool);
        registered = { context: context!, names: tools.map((tool) => tool.name) };
    } catch {
        registered = null; // An early, changing API: never let it break the app.
    }
    return !!registered;
}
