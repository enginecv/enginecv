import Dexie from "dexie";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { deleteLetter, unfreeze } from "@/lib/letters/store";
import { makeCv, makeLetter, makeSentLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { changeStage, newApplication } from "./operations";
import { insertApplication, getApplication } from "./repository";
import { CaptureError, captureSubmission, readSubmissionPacket } from "./submissions";

let counter = 0;
const ctx = (now = 10_000) => ({ now, newId: () => `id-${++counter}` });

async function seedJob(stage: Parameters<typeof changeStage>[1] = "saved") {
    const created = newApplication({ company: "Acme", role: "Designer", workingCvId: "cv-1", workingLetterId: "letter-1" }, ctx());
    return insertApplication(stage === "saved" ? created : changeStage(created, stage, ctx()));
}

const withDocs = { sentOn: "2026-11-20", sentAt: null, channel: "website" as const, reference: "REF-7", cv: { kind: "document" as const, id: "cv-1" }, letter: { kind: "document" as const, id: "letter-1" } };

describe("recording a submission", () => {
    beforeEach(async () => {
        await resetLetterTables();
        await Promise.all([db.jobApplications.clear(), db.jobSubmissionPackets.clear()]);
        await db.resumes.put({ ...makeCv({ title: "Design CV", name: "Amina Hodzic" }), updatedAt: 5 });
        await db.coverLetters.put(makeLetter({ title: "Acme letter" }));
    });

    it("commits one submission, one packet and the move to Applied, leaving the originals untouched", async () => {
        const job = await seedJob();
        const cvBefore = await db.resumes.get("cv-1");
        const letterBefore = await db.coverLetters.get("letter-1");
        const saved = await captureSubmission(job.id, job.revision, withDocs, ctx(20_000));

        expect(saved.stage).toBe("applied");
        expect(saved.submissions).toHaveLength(1);
        const [submission] = saved.submissions;
        expect(submission.cv).toMatchObject({ status: "captured", sourceId: "cv-1", capturedTitle: "Design CV", sourceUpdatedAt: 5 });
        expect(submission.letter).toMatchObject({ status: "captured", sourceId: "letter-1", capturedTitle: "Acme letter" });
        expect(saved.events.map((event) => event.type)).toEqual(["created", "submission-recorded", "stage-changed"]);
        expect(await db.jobSubmissionPackets.count()).toBe(1);
        expect(await db.resumes.get("cv-1")).toEqual(cvBefore);
        // Recording never marks the working letter as sent.
        expect(await db.coverLetters.get("letter-1")).toEqual(letterBefore);

        const read = await readSubmissionPacket(job.id, submission);
        expect(read.status).toBe("available");
        if (read.status !== "available") return;
        expect(read.documents.cv?.resume.basics.name).toBe("Amina Hodzic");
        // The letter copy is frozen against the CV it follows.
        expect(read.documents.letter?.letter).toMatchObject({ status: "sent", frozen: { sender: { name: "Amina Hodzic" } } });
    });

    it("keeps the copies when the originals are edited, renamed, unfrozen or deleted", async () => {
        const job = await seedJob();
        const saved = await captureSubmission(job.id, job.revision, withDocs, ctx());
        const [submission] = saved.submissions;
        const packetBefore = await db.jobSubmissionPackets.get(submission.packetId!);

        await db.resumes.put({ ...makeCv({ title: "Renamed", name: "Someone Else" }), updatedAt: 99 });
        await db.coverLetters.put(makeSentLetter({ senderName: "Changed" }));
        await unfreeze("letter-1", "cv-1");
        await deleteLetter("letter-1");
        await db.resumes.delete("cv-1");

        expect(await db.jobSubmissionPackets.get(submission.packetId!)).toEqual(packetBefore);
        const read = await readSubmissionPacket(job.id, submission);
        expect(read.status === "available" && read.documents.cv?.resume.basics.name).toBe("Amina Hodzic");
        expect(read.status === "available" && read.documents.letter?.letter.frozen?.sender.name).toBe("Amina Hodzic");
    });

    it("records None and Unknown without a packet and without fabricating documents", async () => {
        const job = await seedJob();
        const saved = await captureSubmission(job.id, job.revision, { ...withDocs, cv: { kind: "none" }, letter: { kind: "unknown" } }, ctx());
        expect(saved.submissions[0]).toMatchObject({ cv: { status: "none" }, letter: { status: "unknown" }, packetId: null, packetSha256: null });
        expect(await db.jobSubmissionPackets.count()).toBe(0);
    });

    it("leaves later stages alone and adds only the submission event", async () => {
        const job = await seedJob("interviewing");
        const saved = await captureSubmission(job.id, job.revision, withDocs, ctx());
        expect(saved.stage).toBe("interviewing");
        expect(saved.events.at(-1)?.type).toBe("submission-recorded");
    });

    it("writes nothing when the letter cannot be resolved against its CV", async () => {
        const job = await seedJob();
        await db.coverLetters.put(makeLetter({ cvId: "gone" }));
        await expect(captureSubmission(job.id, job.revision, withDocs, ctx())).rejects.toMatchObject({ problem: "letter-unresolved" });
        expect(await db.jobSubmissionPackets.count()).toBe(0);
        expect(await getApplication(job.id)).toEqual(job);
    });

    it("writes nothing for a stale application revision", async () => {
        const job = await seedJob();
        await expect(captureSubmission(job.id, job.revision + 1, withDocs, ctx())).rejects.toThrow(/changed elsewhere/);
        expect(await db.jobSubmissionPackets.count()).toBe(0);
    });

    it("rolls the packet back when the application write fails", async () => {
        const job = await seedJob();
        const put = vi.spyOn(db.jobApplications, "put").mockRejectedValueOnce(new Error("QuotaExceededError"));
        await expect(captureSubmission(job.id, job.revision, withDocs, ctx())).rejects.toThrow("QuotaExceededError");
        put.mockRestore();
        expect(await db.jobSubmissionPackets.count()).toBe(0);
        expect(await getApplication(job.id)).toEqual(job);
    });

    it("reads a source again when it changed during capture, and stops if it keeps changing", async () => {
        const job = await seedJob();
        let checks = 0;
        const original = db.resumes.get.bind(db.resumes);
        // Every check inside the write transaction sees a newer save than the copy did.
        const get = vi.spyOn(db.resumes, "get").mockImplementation((async (key: string) => {
            const row = await original(key);
            if (!row || !Dexie.currentTransaction || Dexie.currentTransaction.mode !== "readwrite") return row;
            checks += 1;
            return { ...row, updatedAt: (row.updatedAt ?? 0) + 1000 };
        }) as never);
        await expect(captureSubmission(job.id, job.revision, withDocs, ctx())).rejects.toBeInstanceOf(CaptureError);
        get.mockRestore();
        expect(checks).toBe(2);
        expect(await db.jobSubmissionPackets.count()).toBe(0);
        expect((await getApplication(job.id))?.submissions).toEqual([]);
    });

    it("reports a missing or altered packet instead of rebuilding it", async () => {
        const job = await seedJob();
        const saved = await captureSubmission(job.id, job.revision, withDocs, ctx());
        const [submission] = saved.submissions;
        const record = (await db.jobSubmissionPackets.get(submission.packetId!))!;
        await db.jobSubmissionPackets.put({ ...record, text: record.text.replace("Amina", "Imposter") });
        expect(await readSubmissionPacket(job.id, submission)).toEqual({ status: "invalid", problem: "hash-mismatch" });
        await db.jobSubmissionPackets.delete(record.id);
        expect(await readSubmissionPacket(job.id, submission)).toEqual({ status: "missing" });
    });
});
