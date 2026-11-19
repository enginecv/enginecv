import { db } from "@/lib/db";
import { detachLink, getActiveEngine } from "@/lib/linked-file/controller";
import { removeLink } from "@/lib/linked-file/link-store";
import { useResumeStore } from "@/lib/store";

/**
 * A CV is either linked to a single file (the older feature) or part of a workspace folder, never
 * both. These two questions are all the rest of the app needs to keep that true.
 */

/** Ids of CVs that still have a per-CV file link. */
export async function linkedCvIds(): Promise<Set<string>> {
    return new Set((await db.linkedFiles.toCollection().primaryKeys()) as string[]);
}

export async function isLinkedCv(resumeId: string): Promise<boolean> {
    return (await db.linkedFiles.get(resumeId)) !== undefined;
}

/** True when the CV is mirrored into a workspace folder right now. */
export async function isInWorkspace(resumeId: string): Promise<boolean> {
    const row = await db.workspaceDocs.get(resumeId);
    return !!row && row.included;
}

/** Ends the old link for a CV that now lives in the workspace. The file and the CV's content are left as they are. */
export async function dropLinkForMove(resumeId: string): Promise<void> {
    if (getActiveEngine(resumeId)) detachLink();
    await removeLink(resumeId);
    if (useResumeStore.getState().activeResumeId === resumeId) useResumeStore.getState().resetLinkedFile();
}
