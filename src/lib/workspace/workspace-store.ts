import { db } from "@/lib/db";
import {
    ACTIVITY_CAP,
    type DocReason,
    type DocState,
    type WorkspaceActivityRecord,
    type WorkspaceDocRecord,
    type WorkspaceRecord,
} from "./types";

/**
 * The only place that reads or writes the workspace tables. Rows hold state, never document text
 * (spec FR-050): reasons carry codes, counts, paths and ids.
 */

export const CURRENT = "current" as const;

export async function getWorkspace(): Promise<WorkspaceRecord | undefined> {
    return db.workspace.get(CURRENT);
}

export async function saveWorkspace(record: Omit<WorkspaceRecord, "id">): Promise<WorkspaceRecord> {
    const row: WorkspaceRecord = { ...record, id: CURRENT };
    await db.workspace.put(row);
    return row;
}

export async function updateWorkspace(patch: Partial<Omit<WorkspaceRecord, "id" | "handle">>): Promise<void> {
    await db.workspace.update(CURRENT, patch);
}

/** Forgets the workspace and every per-document row. The folder and its files are not touched. */
export async function clearWorkspace(): Promise<void> {
    await db.transaction("rw", db.workspace, db.workspaceDocs, async () => {
        await db.workspace.delete(CURRENT);
        await db.workspaceDocs.clear();
    });
}

export async function getDocRow(docId: string): Promise<WorkspaceDocRecord | undefined> {
    return db.workspaceDocs.get(docId);
}

export async function listDocRows(): Promise<WorkspaceDocRecord[]> {
    return db.workspaceDocs.toArray();
}

export function newDocRow(base: Pick<WorkspaceDocRecord, "docId" | "kind"> & Partial<WorkspaceDocRecord>, now: number): WorkspaceDocRecord {
    return {
        fileName: null,
        included: true,
        state: "in-sync",
        lastHash: null,
        lastStamp: null,
        reason: null,
        pendingReview: null,
        updatedAt: now,
        ...base,
    };
}

export async function putDocRow(row: WorkspaceDocRecord): Promise<void> {
    await db.workspaceDocs.put(row);
}

/** Sets a document's state and reason (null clears it), creating nothing: the row must exist. */
export async function setDocState(docId: string, state: DocState, reason: DocReason | null = null, now: number = Date.now()): Promise<void> {
    await db.workspaceDocs.update(docId, { state, reason, updatedAt: now });
}

export async function patchDocRow(docId: string, patch: Partial<Omit<WorkspaceDocRecord, "docId">>, now: number = Date.now()): Promise<void> {
    await db.workspaceDocs.update(docId, { ...patch, updatedAt: now });
}

export async function removeDocRow(docId: string): Promise<void> {
    await db.workspaceDocs.delete(docId);
}

/** Appends an activity entry and drops the oldest beyond the cap. */
export async function addActivity(entry: Omit<WorkspaceActivityRecord, "id">): Promise<number> {
    return db.transaction("rw", db.workspaceActivity, async () => {
        const id = await db.workspaceActivity.add(entry);
        const count = await db.workspaceActivity.count();
        if (count > ACTIVITY_CAP) {
            const oldest = await db.workspaceActivity.orderBy("id").limit(count - ACTIVITY_CAP).primaryKeys();
            await db.workspaceActivity.bulkDelete(oldest);
        }
        return id;
    });
}

/** Newest first; pass the last id of the previous page as `before` to page. */
export async function listActivity(options: { limit?: number; before?: number } = {}): Promise<WorkspaceActivityRecord[]> {
    const limit = options.limit ?? 50;
    const rows = await db.workspaceActivity.orderBy("id").reverse().toArray();
    const filtered = options.before === undefined ? rows : rows.filter((row) => (row.id ?? 0) < options.before!);
    return filtered.slice(0, limit);
}

export async function getActivity(id: number): Promise<WorkspaceActivityRecord | undefined> {
    return db.workspaceActivity.get(id);
}
