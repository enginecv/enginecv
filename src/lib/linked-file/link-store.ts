import { db, type LinkedFileRecord } from "@/lib/db";

/** The handle is already linked to another CV. */
export class LinkedElsewhereError extends Error {
    constructor(readonly ownerResumeId: string) {
        super(`file already linked to ${ownerResumeId}`);
        this.name = "LinkedElsewhereError";
    }
}

export async function getLink(resumeId: string): Promise<LinkedFileRecord | undefined> {
    return db.linkedFiles.get(resumeId);
}

export async function listLinks(): Promise<LinkedFileRecord[]> {
    return db.linkedFiles.toArray();
}

/** Saves the link; a file can belong to one CV only. */
export async function saveLink(record: LinkedFileRecord): Promise<void> {
    for (const other of await db.linkedFiles.toArray()) {
        if (other.resumeId === record.resumeId) continue;
        const same = await other.handle.isSameEntry(record.handle).catch(() => false);
        if (same) throw new LinkedElsewhereError(other.resumeId);
    }
    await db.linkedFiles.put(record);
}

export async function setPaused(resumeId: string, paused: boolean): Promise<void> {
    await db.linkedFiles.update(resumeId, { paused });
}

export async function updateFileName(resumeId: string, fileName: string): Promise<void> {
    await db.linkedFiles.update(resumeId, { fileName });
}

export async function removeLink(resumeId: string): Promise<void> {
    await db.linkedFiles.delete(resumeId);
}
