import { db } from "@/lib/db";
import type { DirectoryAdapter } from "./directory-adapter";
import { includeDocument } from "./lifecycle";
import { dropLinkForMove } from "./link-guard";
import { newDocRow, putDocRow } from "./workspace-store";

/**
 * Moving a CV from the older per-CV file link into the workspace folder. The CV's file in the folder
 * is written through the normal path first; only when it is there is the link row removed, so a CV is
 * never left with neither, and never has both. The old file is never touched: it stays where it is.
 */

export interface LinkedCv {
    resumeId: string;
    title: string;
    fileName: string;
}

/** CVs that still have a link and still exist. */
export async function listLinkedCvs(): Promise<LinkedCv[]> {
    const links = await db.linkedFiles.toArray();
    const found: LinkedCv[] = [];
    for (const link of links) {
        const cv = await db.resumes.get(link.resumeId);
        if (cv) found.push({ resumeId: link.resumeId, title: cv.meta?.title || cv.basics?.name || link.fileName, fileName: link.fileName });
    }
    return found;
}

export type MoveResult = { ok: true } | { ok: false; reason: "not-linked" | "failed" };

/** Copies one linked CV into the workspace folder, then ends its link. */
export async function moveLinkedCv(adapter: DirectoryAdapter, resumeId: string, options: { hideContact: boolean }): Promise<MoveResult> {
    if (!(await db.linkedFiles.get(resumeId))) return { ok: false, reason: "not-linked" };
    try {
        // A CV the workspace has not met yet gets a row; the file itself is written by the usual include path.
        if (!(await db.workspaceDocs.get(resumeId))) await putDocRow(newDocRow({ docId: resumeId, kind: "cv", fileName: null, included: false }, Date.now()));
        const included = await includeDocument(adapter, resumeId, "keep-app", options, { allowLinked: true });
        const row = await db.workspaceDocs.get(resumeId);
        if (!included.ok || !row?.included || !row.fileName || !(await adapter.exists("cvs", row.fileName))) return { ok: false, reason: "failed" };
    } catch {
        return { ok: false, reason: "failed" };
    }
    await dropLinkForMove(resumeId);
    return { ok: true };
}

export async function moveLinkedCvs(adapter: DirectoryAdapter, resumeIds: readonly string[], options: { hideContact: boolean }): Promise<{ moved: string[]; failed: string[] }> {
    const moved: string[] = [];
    const failed: string[] = [];
    for (const id of resumeIds) ((await moveLinkedCv(adapter, id, options)).ok ? moved : failed).push(id);
    return { moved, failed };
}
