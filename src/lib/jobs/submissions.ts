import { APP_VERSION } from "@/lib/app-version";
import { db } from "@/lib/db";
import { createId } from "@/lib/id";
import { freezeLetter } from "@/lib/letters/freeze";
import { letterDocumentSchema, type LetterDocument } from "@/lib/letters/schema";
import { getLetter, loadCv, parseCv } from "@/lib/letters/store";
import type { Resume } from "@/lib/schema";
import { recordSubmission, type OperationContext } from "./operations";
import { packetRecord, verifyPacket, type PacketProblem } from "./packets";
import { ApplicationNotFoundError, StaleApplicationError } from "./repository";
import {
    jobApplicationSchema,
    SUBMISSION_PACKET_FORMAT,
    type ApplicationSubmission,
    type DocumentSelection,
    type JobApplication,
    type SubmissionPacketEnvelope,
} from "./schema";

/**
 * Recording what was sent. The working CV and letter stay editable; a submission freezes independent
 * copies of them into one immutable packet. A letter is resolved against the CV it actually follows (its
 * sender, design and token values), exactly as "mark as sent" would freeze it, but the working letter is
 * never changed. Nothing is sent anywhere and no network request is made.
 */

/** A slot on the record form: nothing sent, not recorded, or a document from this browser. */
export type SlotChoice = { kind: "none" } | { kind: "unknown" } | { kind: "document"; id: string };

export interface SubmissionInput {
    sentOn: string;
    sentAt: number | null;
    channel: ApplicationSubmission["channel"];
    reference: string | null;
    cv: SlotChoice;
    letter: SlotChoice;
}

export type CaptureProblem = "cv-missing" | "letter-missing" | "letter-unresolved" | "source-changed";

/** Capture stopped before anything was written; the form stays open and the person can retry. */
export class CaptureError extends Error {
    constructor(readonly problem: CaptureProblem) {
        super(`Could not capture the submission: ${problem}`);
        this.name = "CaptureError";
    }
}

/** What the person sees as a document's name, kept with the copy so a later rename does not change it. */
export function cvTitle(cv: Pick<Resume, "meta" | "basics">): string {
    return cv.meta?.title?.trim() || cv.basics?.name?.trim() || "";
}

export function letterTitle(letter: Pick<LetterDocument, "title" | "company" | "role">): string {
    return letter.title.trim() || [letter.company, letter.role].map((part) => part.trim()).filter(Boolean).join(" - ");
}

interface CvCopy { sourceId: string; title: string; sourceUpdatedAt: number; resume: Resume }
interface LetterCopy { sourceId: string; title: string; sourceUpdatedAt: number; letter: LetterDocument }

async function copyCv(id: string): Promise<CvCopy> {
    const row = await db.resumes.get(id);
    const cv = parseCv(row);
    if (!row || !cv) throw new CaptureError("cv-missing");
    return { sourceId: id, title: cvTitle(cv), sourceUpdatedAt: row.updatedAt ?? 0, resume: structuredClone(cv) };
}

/** A frozen copy: an already sent letter as it is, a draft resolved against the CV it follows. */
async function copyLetter(id: string, now: number): Promise<LetterCopy> {
    const letter = await getLetter(id);
    if (!letter) throw new CaptureError("letter-missing");
    let frozen: LetterDocument;
    if (letter.status !== "draft" && letter.frozen) {
        frozen = structuredClone(letter);
    } else {
        const followed = letter.standalone ? null : await loadCv(letter.cvId);
        if (!letter.standalone && !followed) throw new CaptureError("letter-unresolved");
        frozen = freezeLetter(letter, followed, now);
    }
    return { sourceId: id, title: letterTitle(letter), sourceUpdatedAt: letter.updatedAt, letter: frozen };
}

function selection(choice: SlotChoice, copy: CvCopy | LetterCopy | null, packetId: string): DocumentSelection {
    if (choice.kind === "none") return { status: "none" };
    if (choice.kind === "unknown" || !copy) return { status: "unknown" };
    return { status: "captured", sourceId: copy.sourceId, capturedTitle: copy.title, sourceUpdatedAt: copy.sourceUpdatedAt, snapshotId: packetId };
}

async function captureOnce(applicationId: string, expectedRevision: number, input: SubmissionInput, ctx: OperationContext): Promise<JobApplication> {
    const cv = input.cv.kind === "document" ? await copyCv(input.cv.id) : null;
    const letter = input.letter.kind === "document" ? await copyLetter(input.letter.id, ctx.now) : null;
    const submissionId = ctx.newId();
    const packetId = cv || letter ? ctx.newId() : null;

    // Serialized and hashed before the write transaction, which must not await anything slow.
    const packet = packetId
        ? await packetRecord({
            format: SUBMISSION_PACKET_FORMAT,
            id: packetId,
            applicationId,
            submissionId,
            capturedAt: new Date(ctx.now).toISOString(),
            renderer: { appVersion: APP_VERSION },
            cv: cv ? { ...cv } : null,
            letter: letter ? { ...letter } : null,
        } satisfies SubmissionPacketEnvelope)
        : null;

    const submission: ApplicationSubmission = {
        id: submissionId,
        sentOn: input.sentOn,
        sentAt: input.sentAt,
        channel: input.channel,
        reference: input.reference,
        cv: selection(input.cv, cv, packetId ?? ""),
        letter: selection(input.letter, letter, packetId ?? ""),
        packetId,
        packetSha256: packet?.sha256 ?? null,
        recordedAt: ctx.now,
    };

    return db.transaction("rw", [db.jobApplications, db.jobSubmissionPackets, db.resumes, db.coverLetters], async () => {
        const current = await db.jobApplications.get(applicationId);
        if (!current) throw new ApplicationNotFoundError(applicationId);
        if (current.revision !== expectedRevision) throw new StaleApplicationError(applicationId, expectedRevision, current.revision);
        // A document saved again since it was read (another tab, the folder) would make the copy stale.
        if (cv && (await db.resumes.get(cv.sourceId))?.updatedAt !== cv.sourceUpdatedAt) throw new CaptureError("source-changed");
        if (letter && (await db.coverLetters.get(letter.sourceId))?.updatedAt !== letter.sourceUpdatedAt) throw new CaptureError("source-changed");
        const next = jobApplicationSchema.parse({
            ...recordSubmission(current, submission, ctx),
            revision: current.revision + 1,
            updatedAt: Math.max(ctx.now, current.updatedAt),
        });
        if (packet) await db.jobSubmissionPackets.add(packet);
        await db.jobApplications.put(next);
        return next;
    });
}

/**
 * Records a submission in one transaction: the packet (when a document was selected), the submission
 * and its event, and the stage move. A source that changes while it is being copied is read again once;
 * if it changes again the capture stops and reports it. Any failure writes nothing.
 */
export async function captureSubmission(
    applicationId: string,
    expectedRevision: number,
    input: SubmissionInput,
    ctx: OperationContext = { now: Date.now(), newId: createId },
): Promise<JobApplication> {
    try {
        return await captureOnce(applicationId, expectedRevision, input, ctx);
    } catch (error) {
        if (error instanceof CaptureError && error.problem === "source-changed") return captureOnce(applicationId, expectedRevision, input, { ...ctx, now: Date.now() });
        throw error;
    }
}

export interface CapturedDocuments {
    capturedAt: number;
    cv: (Omit<CvCopy, "resume"> & { resume: Resume }) | null;
    letter: LetterCopy | null;
}

export type PacketReadResult =
    | { status: "available"; documents: CapturedDocuments }
    | { status: "missing" }
    | { status: "invalid"; problem: PacketProblem | "unreadable-document" };

/**
 * Reads a submission's packet back, checking its bytes against the hash the submission recorded. A
 * missing packet is reported as missing (for example, evidence not yet restored); it is never rebuilt
 * from the live documents.
 */
export async function readSubmissionPacket(applicationId: string, submission: ApplicationSubmission): Promise<PacketReadResult> {
    if (!submission.packetId || !submission.packetSha256) return { status: "missing" };
    const record = await db.jobSubmissionPackets.get(submission.packetId);
    if (!record) return { status: "missing" };
    const problem = await verifyPacket(record.text, { applicationId, submissionId: submission.id, packetId: submission.packetId, sha256: submission.packetSha256 });
    if (problem) return { status: "invalid", problem };
    const envelope = JSON.parse(record.text) as SubmissionPacketEnvelope;
    const cv = envelope.cv as (Omit<CvCopy, "resume"> & { resume: unknown }) | null;
    const letter = envelope.letter as (Omit<LetterCopy, "letter"> & { letter: unknown }) | null;
    const resume = cv ? parseCv(cv.resume) : null;
    const parsedLetter = letter ? letterDocumentSchema.safeParse(letter.letter) : null;
    if ((cv && !resume) || (parsedLetter && !parsedLetter.success)) return { status: "invalid", problem: "unreadable-document" };
    return {
        status: "available",
        documents: {
            capturedAt: Date.parse(envelope.capturedAt),
            cv: cv && resume ? { sourceId: cv.sourceId, title: cv.title, sourceUpdatedAt: cv.sourceUpdatedAt, resume } : null,
            letter: letter && parsedLetter?.success ? { sourceId: letter.sourceId, title: letter.title, sourceUpdatedAt: letter.sourceUpdatedAt, letter: parsedLetter.data } : null,
        },
    };
}
