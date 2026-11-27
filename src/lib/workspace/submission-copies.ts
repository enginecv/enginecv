import { db } from "@/lib/db";
import { sha256Hex, verifyPacket } from "@/lib/jobs/packets";
import { submissionPacketEnvelopeSchema, type SubmissionPacketRecord } from "@/lib/jobs/schema";
import type { DirectoryAdapter } from "./directory-adapter";

/**
 * Recorded copies of submitted documents in `submissions/<packet id>.submission.json`. They are immutable,
 * so this is not a sync engine: a copy is written once (and read back to check), a file whose bytes differ
 * from the copy with the same id is a conflict and is never replaced, and a copy is imported from the folder
 * only when a job here refers to it and its hash, envelope and owner check out. Copies no job here refers to
 * are counted, never imported or deleted. Nothing is ever rebuilt from the live CV or letter.
 */

export const SUBMISSIONS_DIR = "submissions";
export const SUBMISSION_EXTENSION = ".submission.json";
/** Largest copy written or read; a CV with many large images can approach it. */
export const MAX_PACKET_BYTES = 10 * 1024 * 1024;

export interface CopiesResult {
    written: number;
    imported: number;
    /** Copies whose file holds different bytes (never overwritten) or fails its checks. */
    conflicts: string[];
    /** Copies over the size cap: kept in this browser, not written or read. */
    tooLarge: string[];
    /** Files no job here refers to. */
    unreferenced: number;
}

const fileName = (packetId: string) => `${packetId}${SUBMISSION_EXTENSION}`;
const bytes = (text: string) => new TextEncoder().encode(text).length;

/** The packets the jobs here refer to, with what each one must be. */
async function references(): Promise<Map<string, { applicationId: string; submissionId: string; sha256: string }>> {
    const result = new Map<string, { applicationId: string; submissionId: string; sha256: string }>();
    for (const application of await db.jobApplications.toArray()) {
        for (const submission of application.submissions) {
            if (submission.packetId && submission.packetSha256) {
                result.set(submission.packetId, { applicationId: application.id, submissionId: submission.id, sha256: submission.packetSha256 });
            }
        }
    }
    return result;
}

export async function syncSubmissionCopies(adapter: DirectoryAdapter, options: { write: boolean }): Promise<CopiesResult> {
    const result: CopiesResult = { written: 0, imported: 0, conflicts: [], tooLarge: [], unreferenced: 0 };
    const wanted = await references();
    const listed = await adapter.listFiles(SUBMISSIONS_DIR);
    const inFolder = new Map(listed.filter((file) => file.name.endsWith(SUBMISSION_EXTENSION)).map((file) => [file.name.slice(0, -SUBMISSION_EXTENSION.length), file]));

    for (const id of inFolder.keys()) if (!wanted.has(id)) result.unreferenced += 1;

    for (const [packetId, owner] of wanted) {
        const local = await db.jobSubmissionPackets.get(packetId);
        const file = inFolder.get(packetId);

        if (local) {
            if (!options.write) continue;
            if (bytes(local.text) > MAX_PACKET_BYTES) {
                result.tooLarge.push(packetId);
                continue;
            }
            if (file) {
                const existing = await adapter.readText(SUBMISSIONS_DIR, fileName(packetId));
                if (existing !== null && existing !== local.text) result.conflicts.push(packetId);
                continue;
            }
            await adapter.writeText(SUBMISSIONS_DIR, fileName(packetId), local.text);
            // Read back: a half-written or altered copy is reported, not trusted.
            const check = await adapter.readText(SUBMISSIONS_DIR, fileName(packetId));
            if (check === null || (await sha256Hex(check)) !== local.sha256) result.conflicts.push(packetId);
            else result.written += 1;
            continue;
        }

        // A job here refers to a copy this browser does not have: take it from the folder if it is the right one.
        if (!file) continue;
        if (file.size > MAX_PACKET_BYTES) {
            result.tooLarge.push(packetId);
            continue;
        }
        const text = await adapter.readText(SUBMISSIONS_DIR, fileName(packetId));
        if (text === null) continue;
        const problem = await verifyPacket(text, { ...owner, packetId });
        if (problem) {
            result.conflicts.push(packetId);
            continue;
        }
        const envelope = submissionPacketEnvelopeSchema.parse(JSON.parse(text));
        const record: SubmissionPacketRecord = { id: packetId, applicationId: owner.applicationId, submissionId: owner.submissionId, capturedAt: Date.parse(envelope.capturedAt), sha256: owner.sha256, text };
        // Added only if still missing: the same id never gets other bytes.
        await db.transaction("rw", db.jobSubmissionPackets, async () => {
            if (!(await db.jobSubmissionPackets.get(packetId))) {
                await db.jobSubmissionPackets.add(record);
                result.imported += 1;
            }
        });
    }
    return result;
}
