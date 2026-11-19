import type { DirectoryAdapter } from "./directory-adapter";
import { MACHINE_DIR } from "./agent-files";
import { db } from "@/lib/db";
import { applyContent } from "@/lib/linked-file/apply-content";
import { recordResumeHistory } from "@/lib/history";
import { parseHistoryResume } from "@/lib/history";
import { letterFromHistory } from "@/lib/letters/history";
import { recordLetterHistory } from "@/lib/letters/history";
import { letterDocumentSchema } from "@/lib/letters/schema";
import { parseCv } from "@/lib/letters/store";
import { useResumeStore } from "@/lib/store";
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

export interface ActivityPage {
    rows: WorkspaceActivityRecord[];
    /** More, older entries exist beyond these. */
    hasMore: boolean;
}

/** Newest first. Only `limit` entries are read, so a long history costs nothing until the person asks for older ones. */
export async function listActivityPage(options: { limit?: number; docId?: string | null } = {}): Promise<ActivityPage> {
    const limit = options.limit ?? 50;
    // The table is capped at 500 rows, so reading one document's rows and sorting them is cheap.
    const newestFirst = options.docId
        ? (await db.workspaceActivity.where("docId").equals(options.docId).toArray()).sort((x, y) => (y.id ?? 0) - (x.id ?? 0)).slice(0, limit + 1)
        : await db.workspaceActivity.orderBy("id").reverse().limit(limit + 1).toArray();
    return { rows: newestFirst.slice(0, limit), hasMore: newestFirst.length > limit };
}

export type UndoResult = { ok: true } | { ok: false; reason: "not-undoable" | "gone" | "unreadable" };

/**
 * Puts a document back to what it was before an accepted change: the restore point taken just before
 * that change. The state it had right now is kept as a restore point first, so an undo can itself be
 * undone, and the file follows the document as for any other change. Design, photo and signature stay.
 */
export async function undoActivity(activityId: number, now: number = Date.now()): Promise<UndoResult> {
    const entry = await db.workspaceActivity.get(activityId);
    if (!entry || entry.kind !== "accepted" || entry.restoreId === null || !entry.docId || entry.undone) return { ok: false, reason: "not-undoable" };
    const docId = entry.docId;

    if (entry.restoreKind === "letter") {
        const point = await db.letterHistory.get(entry.restoreId);
        const row = await db.coverLetters.get(docId);
        const current = row ? letterDocumentSchema.safeParse(row) : null;
        if (!point || !current?.success) return { ok: false, reason: "gone" };
        if (current.data.status !== "draft") return { ok: false, reason: "not-undoable" };
        const restored = letterFromHistory(point, current.data);
        if (!restored) return { ok: false, reason: "unreadable" };
        await recordLetterHistory(current.data, "manual", now);
        await db.coverLetters.put({ ...restored, id: docId, updatedAt: Math.max(now, current.data.updatedAt + 1) });
    } else {
        const point = await db.resumeHistory.get(entry.restoreId);
        const row = await db.resumes.get(docId);
        const current = row ? parseCv(row) : null;
        if (!point || !current) return { ok: false, reason: "gone" };
        const restored = parseHistoryResume(point);
        if (!restored) return { ok: false, reason: "unreadable" };
        const open = useResumeStore.getState().activeResumeId === docId;
        const before = open ? useResumeStore.getState().resume : current;
        await recordResumeHistory(before, "restore");
        if (open) {
            // The editor holds this CV: change it there so its own save cannot bring the old content back.
            useResumeStore.getState().applyContentTransform((resume) => applyContent(resume, restored));
            await useResumeStore.getState().saveToDb();
        } else {
            await db.resumes.put({ ...applyContent(current, restored), id: docId, updatedAt: Math.max(now, current.updatedAt + 1) });
        }
    }
    await db.workspaceActivity.update(activityId, { undone: true });
    await recordActivity({ docId, kind: "info", code: "undone", now });
    return { ok: true };
}
