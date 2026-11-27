import { db } from "@/lib/db";
import type { TrackerBackup } from "./backup";
import { recordApplicationHistory } from "./history";
import { jobApplicationSchema, type JobApplication, type SubmissionPacketRecord } from "./schema";

/**
 * Restoring a validated tracker backup (see `parseTrackerBackup`). The preview sorts every application into
 * new, identical or colliding (same id, different content). Collisions are skipped unless the person picks
 * "keep this browser's" or "replace with the backup" for each; replacing saves a restore point first.
 * Packets are immutable: one already here with the same id is never replaced, whatever its bytes.
 * Everything is written in one transaction. "Keep both" is not offered: ids would need remapping.
 */

export type CollisionChoice = "skip" | "keep-local" | "replace";

export interface RestorePreview {
    added: JobApplication[];
    identical: JobApplication[];
    collisions: { local: JobApplication; incoming: JobApplication }[];
    /** Packets in the backup whose id exists here with different bytes; they are never imported. */
    blockedPackets: string[];
}

/** Content that matters for "identical": the local revision counter is bookkeeping, not content. */
function sameContent(a: JobApplication, b: JobApplication): boolean {
    return JSON.stringify({ ...a, revision: 0 }) === JSON.stringify({ ...b, revision: 0 });
}

export async function previewRestore(backup: TrackerBackup): Promise<RestorePreview> {
    const preview: RestorePreview = { added: [], identical: [], collisions: [], blockedPackets: [] };
    const locals = await db.jobApplications.bulkGet(backup.applications.map((application) => application.id));
    backup.applications.forEach((incoming, index) => {
        const local = locals[index];
        if (!local) preview.added.push(incoming);
        else if (sameContent(local, incoming)) preview.identical.push(incoming);
        else preview.collisions.push({ local, incoming });
    });
    const packets = await db.jobSubmissionPackets.bulkGet(backup.packets.map((packet) => packet.id));
    backup.packets.forEach((packet, index) => {
        const local = packets[index];
        if (local && local.sha256 !== packet.sha256) preview.blockedPackets.push(packet.id);
    });
    return preview;
}

export interface RestoreResult {
    added: number;
    replaced: number;
    skipped: number;
    packetsAdded: number;
}

export class RestoreConflictError extends Error {
    constructor() {
        super("The tracker changed while the restore was being prepared; preview it again.");
        this.name = "RestoreConflictError";
    }
}

/**
 * Applies the preview's decisions. Collisions default to "skip". Packets are added only when an
 * application that ends up in this browser references them and none with that id is here already.
 */
export async function restoreTrackerBackup(
    backup: TrackerBackup,
    preview: RestorePreview,
    choices: Readonly<Record<string, CollisionChoice>>,
    now: number = Date.now(),
): Promise<RestoreResult> {
    const replace = preview.collisions.filter(({ incoming }) => choices[incoming.id] === "replace");
    const result: RestoreResult = { added: preview.added.length, replaced: replace.length, skipped: preview.collisions.length - replace.length, packetsAdded: 0 };
    const incomingPackets = new Map<string, SubmissionPacketRecord>(backup.packets.map((packet) => [packet.id, packet]));

    await db.transaction("rw", [db.jobApplications, db.jobSubmissionPackets, db.jobApplicationHistory], async () => {
        // Nothing the preview relied on may have changed since it was shown.
        for (const application of preview.added) {
            if (await db.jobApplications.get(application.id)) throw new RestoreConflictError();
        }
        for (const { local } of replace) {
            if ((await db.jobApplications.get(local.id))?.revision !== local.revision) throw new RestoreConflictError();
        }

        const landing: JobApplication[] = [];
        for (const application of preview.added) {
            const record = jobApplicationSchema.parse(application);
            await db.jobApplications.add(record);
            landing.push(record);
        }
        for (const { local, incoming } of replace) {
            await recordApplicationHistory(local, "restore", now);
            const record = jobApplicationSchema.parse({ ...incoming, revision: local.revision + 1 });
            await db.jobApplications.put(record);
            landing.push(record);
        }
        landing.push(...preview.identical);

        for (const application of landing) {
            for (const submission of application.submissions) {
                if (!submission.packetId) continue;
                const packet = incomingPackets.get(submission.packetId);
                if (!packet || (await db.jobSubmissionPackets.get(packet.id))) continue;
                await db.jobSubmissionPackets.add(packet);
                result.packetsAdded += 1;
            }
        }
    });
    return result;
}
