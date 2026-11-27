import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { parseTrackerBackup, serializeTrackerBackup } from "./backup";
import { changeStage, newApplication, trash } from "./operations";
import { packetRecord } from "./packets";
import {
    ApplicationNotFoundError,
    StaleApplicationError,
    createApplication,
    deleteApplicationPermanently,
    getApplication,
    insertApplication,
    readTrackerBackup,
    updateApplication,
} from "./repository";
import { SUBMISSION_PACKET_FORMAT, type JobApplication } from "./schema";

let counter = 0;
const ctx = (now = 1000) => ({ now, newId: () => `id-${++counter}` });

async function withPacket(): Promise<JobApplication> {
    const app = newApplication({ company: "Acme", role: "Designer" }, ctx());
    const packet = await packetRecord({
        format: SUBMISSION_PACKET_FORMAT,
        id: "packet-1",
        applicationId: app.id,
        submissionId: "sub-1",
        capturedAt: "2026-11-20T10:00:00.000Z",
        renderer: { appVersion: "1.0.0" },
        cv: { title: "Design CV" },
        letter: null,
    });
    const stored: JobApplication = {
        ...app,
        stage: "applied",
        submissions: [{
            id: "sub-1", sentOn: "2026-11-20", sentAt: null, channel: "website", reference: null,
            cv: { status: "captured", sourceId: "cv-1", capturedTitle: "Design CV", sourceUpdatedAt: 5, snapshotId: "snap-1" },
            letter: { status: "none" },
            packetId: packet.id, packetSha256: packet.sha256, recordedAt: 1000,
        }],
    };
    await db.transaction("rw", db.jobApplications, db.jobSubmissionPackets, async () => {
        await db.jobSubmissionPackets.add(packet);
        await db.jobApplications.add(stored);
    });
    return stored;
}

describe("job application repository", () => {
    beforeEach(async () => {
        await Promise.all([db.jobApplications.clear(), db.jobSubmissionPackets.clear(), db.jobApplicationHistory.clear()]);
    });

    it("creates and reads back an application", async () => {
        const app = await createApplication({ company: "Acme", role: "Designer" }, ctx());
        expect(await getApplication(app.id)).toEqual(app);
    });

    it("bumps the revision once per real change and skips no-op changes", async () => {
        const app = await createApplication({ company: "Acme", role: "Designer" }, ctx());
        const moved = await updateApplication(app.id, 1, (current) => changeStage(current, "preparing", ctx(2000)), 2000);
        expect(moved).toMatchObject({ revision: 2, updatedAt: 2000, stage: "preparing" });
        const same = await updateApplication(app.id, 2, (current) => current, 3000);
        expect(same.revision).toBe(2);
    });

    it("refuses a write based on an older revision and keeps the stored record", async () => {
        const app = await createApplication({ company: "Acme", role: "Designer" }, ctx());
        await updateApplication(app.id, 1, (current) => changeStage(current, "preparing", ctx()));
        await expect(updateApplication(app.id, 1, (current) => changeStage(current, "offer", ctx()))).rejects.toBeInstanceOf(StaleApplicationError);
        expect((await getApplication(app.id))?.stage).toBe("preparing");
    });

    it("writes nothing when the changed record is invalid", async () => {
        const app = await createApplication({ company: "Acme", role: "Designer" }, ctx());
        await expect(updateApplication(app.id, 1, (current) => ({ ...current, company: "" }))).rejects.toThrow();
        expect(await getApplication(app.id)).toEqual(app);
        await expect(insertApplication({ ...app, id: "other", jobUrl: "file:///etc/passwd" })).rejects.toThrow();
        expect(await getApplication("other")).toBeUndefined();
    });

    it("reports a missing application", async () => {
        await expect(updateApplication("missing", 1, (current) => current)).rejects.toBeInstanceOf(ApplicationNotFoundError);
    });

    it("removes permanently only from the trash, with its packets, in one step", async () => {
        const app = await withPacket();
        await expect(deleteApplicationPermanently(app.id, 1)).rejects.toThrow(/trash/);
        expect(await db.jobSubmissionPackets.count()).toBe(1);
        const trashed = await updateApplication(app.id, 1, (current) => trash(current, ctx()));
        await deleteApplicationPermanently(app.id, trashed.revision);
        expect(await getApplication(app.id)).toBeUndefined();
        expect(await db.jobSubmissionPackets.count()).toBe(0);
    });
});

describe("job tracker backup", () => {
    beforeEach(async () => {
        await Promise.all([db.jobApplications.clear(), db.jobSubmissionPackets.clear()]);
    });

    it("round-trips applications and exact packet text", async () => {
        const app = await withPacket();
        const text = serializeTrackerBackup(await readTrackerBackup("1.0.0", Date.UTC(2026, 10, 21)));
        expect(JSON.parse(text).applications[0].createdAt).toBe(new Date(app.createdAt).toISOString());
        const parsed = await parseTrackerBackup(text);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.backup.applications).toEqual([app]);
        expect(parsed.backup.packets).toEqual(await db.jobSubmissionPackets.toArray());
    });

    it("refuses a packet whose bytes no longer match its hash", async () => {
        await withPacket();
        const file = JSON.parse(serializeTrackerBackup(await readTrackerBackup("1.0.0")));
        file.packets[0].text = file.packets[0].text.replace("Design CV", "Better CV");
        const parsed = await parseTrackerBackup(JSON.stringify(file));
        expect(parsed).toEqual({ ok: false, problems: [{ kind: "packet", packetId: "packet-1", problem: "hash-mismatch" }] });
    });

    it("refuses packets nobody references, and accepts referenced packets that are absent", async () => {
        await withPacket();
        const file = JSON.parse(serializeTrackerBackup(await readTrackerBackup("1.0.0")));
        const orphan = { ...file, applications: [] };
        expect(await parseTrackerBackup(JSON.stringify(orphan))).toMatchObject({ ok: false, problems: [{ kind: "packet", problem: "unreferenced" }] });
        expect((await parseTrackerBackup(JSON.stringify({ ...file, packets: [] }))).ok).toBe(true);
    });

    it("refuses files that are not tracker backups or are incomplete", async () => {
        expect(await parseTrackerBackup("{")).toEqual({ ok: false, problems: [{ kind: "not-json" }] });
        expect(await parseTrackerBackup(JSON.stringify({ format: "enginecv/data-export" }))).toEqual({ ok: false, problems: [{ kind: "not-a-tracker-backup" }] });
        const app = await withPacket();
        const file = JSON.parse(serializeTrackerBackup(await readTrackerBackup("1.0.0")));
        delete file.applications[0].events;
        expect(await parseTrackerBackup(JSON.stringify(file))).toMatchObject({ ok: false, problems: [{ kind: "invalid" }] });
        expect(app.id).toBeTruthy();
    });
});
