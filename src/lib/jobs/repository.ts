import { db } from "@/lib/db";
import type { TrackerBackup } from "./backup";
import { defaultContext, newApplication, type NewApplicationInput, type OperationContext } from "./operations";
import { jobApplicationSchema, type JobApplication } from "./schema";

/**
 * The only writer of `jobApplications`. Every change runs one read-compare-write transaction: the caller
 * says which revision it edited, and a newer stored revision (another tab, or a folder import) refuses the
 * write instead of overwriting it. The caller keeps its draft and offers reload or reapply.
 */

export class StaleApplicationError extends Error {
    constructor(readonly applicationId: string, readonly expected: number, readonly actual: number) {
        super(`Application ${applicationId} changed elsewhere (expected revision ${expected}, found ${actual})`);
        this.name = "StaleApplicationError";
    }
}

export class ApplicationNotFoundError extends Error {
    constructor(readonly applicationId: string) {
        super(`Application ${applicationId} not found`);
        this.name = "ApplicationNotFoundError";
    }
}

/** Validates before any write; an invalid aggregate never reaches the database. */
function validated(application: JobApplication): JobApplication {
    return jobApplicationSchema.parse(application);
}

export async function getApplication(id: string): Promise<JobApplication | undefined> {
    return db.jobApplications.get(id);
}

/** Every application, trashed ones included; views filter with the selectors. */
export async function listApplications(): Promise<JobApplication[]> {
    return db.jobApplications.toArray();
}

export async function createApplication(input: NewApplicationInput, ctx: OperationContext = defaultContext()): Promise<JobApplication> {
    return insertApplication(newApplication(input, ctx));
}

/** Stores a newly built aggregate (a new or duplicated application). Refuses an id already in use. */
export async function insertApplication(application: JobApplication): Promise<JobApplication> {
    const record = validated(application);
    await db.jobApplications.add(record);
    return record;
}

/**
 * Applies `change` to the stored application if it is still at `expectedRevision`. Returns the stored
 * result; when `change` returns the same object nothing is written and the revision stays put.
 */
export async function updateApplication(
    id: string,
    expectedRevision: number,
    change: (current: JobApplication) => JobApplication,
    now: number = Date.now(),
): Promise<JobApplication> {
    return db.transaction("rw", db.jobApplications, async () => {
        const current = await db.jobApplications.get(id);
        if (!current) throw new ApplicationNotFoundError(id);
        if (current.revision !== expectedRevision) throw new StaleApplicationError(id, expectedRevision, current.revision);
        const next = change(current);
        if (next === current) return current;
        if (next.id !== id) throw new Error("A change cannot alter the application id");
        const record = validated({ ...next, revision: current.revision + 1, updatedAt: Math.max(now, current.updatedAt) });
        await db.jobApplications.put(record);
        return record;
    });
}

/**
 * Permanently removes a trashed application, its frozen packets and its restore points from this browser,
 * in one transaction. Copies in a folder or a downloaded backup are separate and untouched.
 */
export async function deleteApplicationPermanently(id: string, expectedRevision: number): Promise<void> {
    await db.transaction("rw", [db.jobApplications, db.jobSubmissionPackets, db.jobApplicationHistory], async () => {
        const current = await db.jobApplications.get(id);
        if (!current) throw new ApplicationNotFoundError(id);
        if (current.revision !== expectedRevision) throw new StaleApplicationError(id, expectedRevision, current.revision);
        if (current.trashedAt === null) throw new Error("Only an application in the trash can be removed permanently");
        await db.jobSubmissionPackets.where("applicationId").equals(id).delete();
        await db.jobApplicationHistory.where("applicationId").equals(id).delete();
        await db.jobApplications.delete(id);
    });
}

/** Every application and packet, read in one transaction so the backup is a consistent picture. */
export async function readTrackerBackup(appVersion: string, now: number = Date.now()): Promise<TrackerBackup> {
    return db.transaction("r", [db.jobApplications, db.jobSubmissionPackets], async () => ({
        exportedAt: now,
        appVersion,
        applications: await db.jobApplications.toArray(),
        packets: await db.jobSubmissionPackets.toArray(),
    }));
}
