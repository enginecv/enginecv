import type { Table } from "dexie";
import { db } from "@/lib/db";
import { listLettersForCv } from "@/lib/letters/store";
import { restoreRetiredDocument } from "@/lib/workspace/controller";
import type { WorkspaceDocRecord } from "@/lib/workspace/types";

type Row<T> = T extends Table<infer R, never, never> ? R : T extends Table<infer R> ? R : never;
type ResumeRow = Row<typeof db.resumes>;
type LetterRow = Row<typeof db.coverLetters>;
type LinkRow = Row<typeof db.linkedFiles>;
type TemplateRow = Row<typeof db.templates>;

/** Everything a CV delete removes or rewrites, kept for a few seconds so the delete can be undone. */
export interface DeletedCvSnapshot {
    resume: ResumeRow;
    letters: LetterRow[];
    link: LinkRow | undefined;
    /** The workspace row, only when the file was kept (a deleted file is not brought back). */
    workspaceRow: WorkspaceDocRecord | undefined;
}

/** Read before deleting; returns null when the CV is already gone. */
export async function snapshotCvForUndo(cvId: string): Promise<DeletedCvSnapshot | null> {
    const resume = await db.resumes.get(cvId);
    if (!resume) return null;
    return {
        resume,
        letters: await listLettersForCv(cvId),
        link: await db.linkedFiles.get(cvId),
        workspaceRow: await db.workspaceDocs.get(cvId),
    };
}

/** Puts the CV, its letters (as they were before any choice) and its file link back. */
export async function restoreDeletedCv(snapshot: DeletedCvSnapshot, fileKept: boolean): Promise<void> {
    await db.transaction("rw", db.resumes, db.coverLetters, db.linkedFiles, async () => {
        await db.resumes.put(snapshot.resume);
        if (snapshot.letters.length > 0) await db.coverLetters.bulkPut(snapshot.letters);
        if (snapshot.link) await db.linkedFiles.put(snapshot.link);
    });
    if (fileKept && snapshot.workspaceRow) await restoreRetiredDocument(snapshot.workspaceRow).catch(() => undefined);
}

export async function snapshotTemplateForUndo(templateId: string): Promise<TemplateRow | null> {
    return (await db.templates.get(templateId)) ?? null;
}

export async function restoreDeletedTemplate(row: TemplateRow): Promise<void> {
    await db.templates.put(row);
}
