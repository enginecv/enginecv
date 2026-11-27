import { submissionPacketEnvelopeSchema, type SubmissionPacketEnvelope, type SubmissionPacketRecord } from "./schema";

/**
 * Integrity of frozen submission packets. A packet is identified by its id and its SHA-256 over the exact
 * UTF-8 bytes of its text; the text is stored verbatim, so re-serializing can never change the claim.
 */

export async function sha256Hex(text: string): Promise<string> {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Serializes an envelope once and returns the record to store; hashing happens before any write transaction. */
export async function packetRecord(envelope: SubmissionPacketEnvelope): Promise<SubmissionPacketRecord> {
    const parsed = submissionPacketEnvelopeSchema.parse(envelope);
    const text = JSON.stringify(parsed);
    return {
        id: parsed.id,
        applicationId: parsed.applicationId,
        submissionId: parsed.submissionId,
        capturedAt: Date.parse(parsed.capturedAt),
        sha256: await sha256Hex(text),
        text,
    };
}

export type PacketProblem = "hash-mismatch" | "invalid-envelope" | "wrong-owner";

export interface PacketOwner {
    applicationId: string;
    submissionId: string;
    packetId: string;
    sha256: string;
}

/**
 * Checks a packet's text against what its owner expects: the bytes hash to the recorded value, the
 * envelope is valid, and it names the same packet, application and submission. Returns the first problem.
 */
export async function verifyPacket(text: string, expected: PacketOwner): Promise<PacketProblem | null> {
    if ((await sha256Hex(text)) !== expected.sha256) return "hash-mismatch";
    let json: unknown;
    try {
        json = JSON.parse(text);
    } catch {
        return "invalid-envelope";
    }
    const envelope = submissionPacketEnvelopeSchema.safeParse(json);
    if (!envelope.success) return "invalid-envelope";
    const { id, applicationId, submissionId } = envelope.data;
    if (id !== expected.packetId || applicationId !== expected.applicationId || submissionId !== expected.submissionId) return "wrong-owner";
    return null;
}
