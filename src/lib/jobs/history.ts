import { db } from "@/lib/db";
import type { JobApplication, JobApplicationHistoryEntry } from "./schema";

/**
 * Restore points for tracked jobs, taken before an outside change (a folder file or a backup restore)
 * replaces one. They hold the job record only; recorded copies are never part of them and never pruned.
 */

/** Restore points kept per job; older ones are dropped. */
export const MAX_APPLICATION_HISTORY = 30;

export async function recordApplicationHistory(application: JobApplication, trigger: JobApplicationHistoryEntry["trigger"], now: number = Date.now()): Promise<number> {
    const id = await db.jobApplicationHistory.add({ applicationId: application.id, createdAt: now, trigger, application });
    const entries = await db.jobApplicationHistory.where("applicationId").equals(application.id).sortBy("createdAt");
    const excess = entries.length - MAX_APPLICATION_HISTORY;
    if (excess > 0) await db.jobApplicationHistory.bulkDelete(entries.slice(0, excess).map((entry) => entry.id!));
    return id;
}
