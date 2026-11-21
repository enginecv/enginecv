import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { makeCv, resetLetterTables } from "../../test/setup/letter-fixtures";
import { createLetterRecord, deleteCvWithLetters } from "@/lib/letters/store";
import { restoreDeletedCv, restoreDeletedTemplate, snapshotCvForUndo, snapshotTemplateForUndo } from "./cv-undo";

describe("undoing a delete", () => {
    beforeEach(async () => {
        await resetLetterTables();
    });

    it("brings a deleted CV and its letters back exactly as they were", async () => {
        const cv = makeCv();
        await db.resumes.put(cv);
        const letter = await createLetterRecord(cv.id!, { company: "Acme" });

        const snapshot = await snapshotCvForUndo(cv.id!);
        expect(snapshot).not.toBeNull();
        await deleteCvWithLetters(cv.id!, [{ action: "snapshot", letterId: letter.id }]);
        expect(await db.resumes.get(cv.id!)).toBeUndefined();

        await restoreDeletedCv(snapshot!, true);
        expect(await db.resumes.get(cv.id!)).toEqual(cv);
        expect(await db.coverLetters.get(letter.id)).toEqual(letter);
    });

    it("has nothing to snapshot for a CV that is already gone", async () => {
        expect(await snapshotCvForUndo("missing")).toBeNull();
    });

    it("brings a deleted template back", async () => {
        const row = { id: "t1", meta: { name: "Mine", source: "user" }, createdAt: 1, updatedAt: 2 } as never;
        await db.templates.put(row);
        const snapshot = await snapshotTemplateForUndo("t1");
        await db.templates.delete("t1");
        await restoreDeletedTemplate(snapshot!);
        expect(await db.templates.get("t1")).toEqual(row);
    });
});
