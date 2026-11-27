import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";

const VERSION_7 = {
    resumes: "id, updatedAt",
    resumeHistory: "++id, resumeId, createdAt, trigger",
    templates: "id, updatedAt, createdAt",
    linkedFiles: null,
    coverLetters: "id, cvId, updatedAt, status",
    letterParagraphs: "id, updatedAt",
    workspace: "id",
    workspaceDocs: "docId, kind, state",
    workspaceActivity: "++id, at, docId",
    letterHistory: "++id, letterId, createdAt",
};

describe("database version 8", () => {
    it("upgrades a version 7 database without touching CVs, letters or workspace rows", async () => {
        db.close();
        await Dexie.delete(db.name);
        const old = new Dexie(db.name);
        old.version(7).stores(VERSION_7);
        await old.open();
        const cv = { id: "cv-1", title: "Design CV", updatedAt: 5, any: { nested: ["data"] } };
        const letter = { id: "letter-1", cvId: "cv-1", updatedAt: 6, status: "sent" };
        const docRecord = { docId: "cv-1", kind: "cv", state: "synced" };
        await old.table("resumes").add(cv);
        await old.table("coverLetters").add(letter);
        await old.table("workspaceDocs").add(docRecord);
        old.close();

        await db.open();
        expect(db.verno).toBe(8);
        expect(await db.resumes.toArray()).toEqual([cv]);
        expect(await db.coverLetters.toArray()).toEqual([letter]);
        expect(await db.workspaceDocs.toArray()).toEqual([docRecord]);
        expect(await db.jobApplications.count()).toBe(0);
        expect(await db.jobSubmissionPackets.count()).toBe(0);
        expect(await db.jobApplicationHistory.count()).toBe(0);
        expect(db.jobApplications.schema.indexes.map((index) => index.name).sort()).toEqual(["archivedAt", "stage", "trashedAt", "updatedAt"]);
    });
});
