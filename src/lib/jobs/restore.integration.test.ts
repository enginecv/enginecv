import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { makeCv, makeLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { parseTrackerBackup, serializeTrackerBackup } from "./backup";
import { buildCsv, csvCell, type CsvLabels } from "./csv";
import { changeStage, newApplication } from "./operations";
import { insertApplication, readTrackerBackup, updateApplication } from "./repository";
import { previewRestore, restoreTrackerBackup } from "./restore";
import { captureSubmission } from "./submissions";

let counter = 0;
const ctx = (now = 1000) => ({ now, newId: () => `id-${++counter}` });

async function exported() {
    const parsed = await parseTrackerBackup(serializeTrackerBackup(await readTrackerBackup("1.0.0")));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.problems));
    return parsed.backup;
}

describe("restoring a tracker backup", () => {
    beforeEach(async () => {
        await resetLetterTables();
        await Promise.all([db.jobApplications.clear(), db.jobSubmissionPackets.clear(), db.jobApplicationHistory.clear()]);
        await db.resumes.put({ ...makeCv({ title: "Design CV" }), updatedAt: 5 });
        await db.coverLetters.put(makeLetter());
    });

    it("round-trips applications and exact evidence into a fresh database", async () => {
        const job = await insertApplication(newApplication({ company: "Acme", role: "Designer", workingCvId: "cv-1" }, ctx()));
        await captureSubmission(job.id, job.revision, { sentOn: "2026-11-20", sentAt: null, channel: "email", reference: null, cv: { kind: "document", id: "cv-1" }, letter: { kind: "document", id: "letter-1" } }, ctx());
        const backup = await exported();
        const before = { applications: await db.jobApplications.toArray(), packets: await db.jobSubmissionPackets.toArray() };

        await Promise.all([db.jobApplications.clear(), db.jobSubmissionPackets.clear(), db.resumes.clear()]);
        const preview = await previewRestore(backup);
        expect(preview.added).toHaveLength(1);
        const result = await restoreTrackerBackup(backup, preview, {});
        expect(result).toEqual({ added: 1, replaced: 0, skipped: 0, packetsAdded: 1 });
        expect(await db.jobApplications.toArray()).toEqual(before.applications);
        expect(await db.jobSubmissionPackets.toArray()).toEqual(before.packets);
        // The linked CV is gone from this browser: the link stays, visibly unresolved, not removed.
        expect((await db.jobApplications.get(job.id))?.workingCvId).toBe("cv-1");
    });

    it("skips collisions by default, and replaces only on request with a restore point", async () => {
        const job = await insertApplication(newApplication({ company: "Acme", role: "Designer" }, ctx()));
        const backup = await exported();
        await updateApplication(job.id, 1, (current) => changeStage(current, "offer", ctx()));

        const preview = await previewRestore(backup);
        expect(preview.collisions).toHaveLength(1);
        expect(await restoreTrackerBackup(backup, preview, {})).toMatchObject({ skipped: 1, replaced: 0 });
        expect((await db.jobApplications.get(job.id))?.stage).toBe("offer");

        const again = await previewRestore(backup);
        await restoreTrackerBackup(backup, again, { [job.id]: "replace" });
        expect(await db.jobApplications.get(job.id)).toMatchObject({ stage: "saved", revision: 3 });
        const [point] = await db.jobApplicationHistory.toArray();
        expect(point).toMatchObject({ applicationId: job.id, trigger: "restore", application: { stage: "offer" } });
    });

    it("treats a record that differs only in its local revision as identical", async () => {
        await insertApplication(newApplication({ company: "Acme", role: "Designer" }, ctx()));
        const backup = await exported();
        const preview = await previewRestore({ ...backup, applications: backup.applications.map((application) => ({ ...application, revision: 9 })) });
        expect(preview).toMatchObject({ added: [], collisions: [], identical: [expect.anything()] });
    });

    it("refuses to replace a packet whose id already holds different bytes", async () => {
        const job = await insertApplication(newApplication({ company: "Acme", role: "Designer" }, ctx()));
        await captureSubmission(job.id, job.revision, { sentOn: "2026-11-20", sentAt: null, channel: "email", reference: null, cv: { kind: "document", id: "cv-1" }, letter: { kind: "none" } }, ctx());
        const backup = await exported();
        const [packet] = await db.jobSubmissionPackets.toArray();
        await db.jobSubmissionPackets.put({ ...packet, sha256: "f".repeat(64) });
        const preview = await previewRestore(backup);
        expect(preview.blockedPackets).toEqual([packet.id]);
        await restoreTrackerBackup(backup, preview, {});
        expect((await db.jobSubmissionPackets.get(packet.id))?.sha256).toBe("f".repeat(64));
    });
});

describe("CSV summary", () => {
    const labels: CsvLabels = {
        headers: { company: "Company", role: "Role", jobUrl: "Link", stage: "Stage", location: "Location", deadline: "Deadline", lastSent: "Last sent", nextAction: "Next", cv: "CV", letter: "Letter", tags: "Tags", archived: "Archived", created: "Created", updated: "Updated" },
        stage: (stage) => stage.toUpperCase(),
        yes: "yes",
    };

    it("defuses spreadsheet formulas and quotes every cell", () => {
        expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
        expect(csvCell("+1")).toBe("\"'+1\"");
        expect(csvCell("Acme, Inc.")).toBe("\"Acme, Inc.\"");
    });

    it("writes one row per job outside the trash, with document titles", () => {
        const kept = { ...newApplication({ company: "=Evil", role: "Designer", workingCvId: "cv-1" }, ctx(Date.UTC(2026, 10, 1))), tags: ["Remote"] };
        const trashed = { ...newApplication({ company: "Gone", role: "X" }, ctx()), trashedAt: 5 };
        const csv = buildCsv([kept, trashed], labels, { cv: () => "Design CV", letter: () => null }, "2026-11-26");
        const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
        expect(lines).toHaveLength(2);
        expect(lines[1]).toContain("\"'=Evil\"");
        expect(lines[1]).toContain("\"SAVED\"");
        expect(lines[1]).toContain("\"Design CV\"");
        expect(lines[1]).toContain("\"2026-11-01\"");
    });
});
