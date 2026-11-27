import { z } from "zod";
import { verifyPacket, type PacketProblem } from "./packets";
import { portableJobApplicationSchema, type JobApplication, type SubmissionPacketRecord } from "./schema";

/**
 * The complete, portable job tracker backup: every application and the exact text of every frozen packet.
 * Timestamps are ISO 8601 UTC in the file. Reading validates everything (schemas, packet hashes, packet
 * ownership, references) before anything can be written; restoring with a collision preview builds on it.
 */

export const TRACKER_BACKUP_FORMAT = "enginecv.job-tracker-backup/v1";

const packetEntrySchema = z.object({
    id: z.string().min(1),
    applicationId: z.string().min(1),
    submissionId: z.string().min(1),
    capturedAt: z.iso.datetime(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    text: z.string(),
});

const backupFileSchema = z.object({
    format: z.literal(TRACKER_BACKUP_FORMAT),
    exportedAt: z.iso.datetime(),
    appVersion: z.string().min(1),
    applications: z.array(portableJobApplicationSchema),
    packets: z.array(packetEntrySchema),
});

export interface TrackerBackup {
    exportedAt: number;
    appVersion: string;
    applications: JobApplication[];
    packets: SubmissionPacketRecord[];
}

export function serializeTrackerBackup(backup: TrackerBackup): string {
    const file = z.encode(backupFileSchema, {
        format: TRACKER_BACKUP_FORMAT,
        exportedAt: new Date(backup.exportedAt).toISOString(),
        appVersion: backup.appVersion,
        applications: backup.applications,
        packets: backup.packets.map((packet) => ({ ...packet, capturedAt: new Date(packet.capturedAt).toISOString() })),
    });
    return JSON.stringify(file, null, 2);
}

export function trackerBackupFileName(now: Date = new Date()): string {
    return `enginecv-job-tracker-${now.toISOString().slice(0, 10)}.json`;
}

export type BackupProblem =
    | { kind: "not-json" }
    | { kind: "not-a-tracker-backup" }
    | { kind: "invalid"; issues: string[] }
    | { kind: "duplicate-id"; table: "applications" | "packets"; id: string }
    | { kind: "packet"; packetId: string; problem: PacketProblem | "unreferenced" | "metadata-mismatch" };

export type ParsedBackup = { ok: true; backup: TrackerBackup } | { ok: false; problems: BackupProblem[] };

/**
 * Reads a backup file and checks it whole. Packets must match a submission that references them by id
 * and hash; a referenced packet may be absent (evidence that was never backed up stays "pending"), but a
 * packet nobody references, or one whose bytes or owner differ, is a problem, never silently accepted.
 */
export async function parseTrackerBackup(text: string): Promise<ParsedBackup> {
    let json: unknown;
    try {
        json = JSON.parse(text);
    } catch {
        return { ok: false, problems: [{ kind: "not-json" }] };
    }
    if ((json as { format?: unknown } | null)?.format !== TRACKER_BACKUP_FORMAT) return { ok: false, problems: [{ kind: "not-a-tracker-backup" }] };

    const parsed = z.safeDecode(backupFileSchema, json as z.input<typeof backupFileSchema>);
    if (!parsed.success) {
        return { ok: false, problems: [{ kind: "invalid", issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`) }] };
    }

    const problems: BackupProblem[] = [];
    const { applications } = parsed.data;
    const packets = parsed.data.packets.map((packet) => ({ ...packet, capturedAt: Date.parse(packet.capturedAt) }));

    for (const [table, ids] of [["applications", applications.map((item) => item.id)], ["packets", packets.map((item) => item.id)]] as const) {
        const seen = new Set<string>();
        for (const id of ids) {
            if (seen.has(id)) problems.push({ kind: "duplicate-id", table, id });
            seen.add(id);
        }
    }

    const references = new Map<string, { applicationId: string; submissionId: string; sha256: string }>();
    for (const application of applications) {
        for (const submission of application.submissions) {
            if (submission.packetId && submission.packetSha256) {
                references.set(submission.packetId, { applicationId: application.id, submissionId: submission.id, sha256: submission.packetSha256 });
            }
        }
    }

    for (const packet of packets) {
        const owner = references.get(packet.id);
        if (!owner) {
            problems.push({ kind: "packet", packetId: packet.id, problem: "unreferenced" });
            continue;
        }
        if (packet.applicationId !== owner.applicationId || packet.submissionId !== owner.submissionId || packet.sha256 !== owner.sha256) {
            problems.push({ kind: "packet", packetId: packet.id, problem: "metadata-mismatch" });
            continue;
        }
        const problem = await verifyPacket(packet.text, { ...owner, packetId: packet.id });
        if (problem) problems.push({ kind: "packet", packetId: packet.id, problem });
    }

    if (problems.length > 0) return { ok: false, problems };
    return { ok: true, backup: { exportedAt: Date.parse(parsed.data.exportedAt), appVersion: parsed.data.appVersion, applications, packets } };
}
