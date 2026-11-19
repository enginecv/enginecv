import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { makeCv, makeLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { LetterOperationError, convertToSnapshot, copyLettersToCv, createLetterRecord, deleteCvWithLetters, deleteLetter, duplicateLetter, getLetter, listLetters, listLettersForCv, listParagraphs, loadCv, repointLetter, restoreLetter, saveLetter, saveParagraph, deleteParagraph, markSent } from "./store";
import { makeSentLetter } from "../../../test/setup/letter-fixtures";

async function seedCv(overrides: Parameters<typeof makeCv>[0] = {}) {
    const cv = makeCv(overrides);
    await db.resumes.put(cv);
    return cv;
}

describe("letter store", () => {
    beforeEach(async () => {
        await resetLetterTables();
    });

    it("creates a draft linked to a CV with starter content and a last-resolved cache", async () => {
        const cv = await seedCv({ language: "de" });
        const letter = await createLetterRecord(cv.id!, { company: "Acme", role: "Designerin" });
        expect(letter).toMatchObject({ cvId: cv.id, status: "draft", language: "de", layout: "din5008", company: "Acme" });
        expect(letter.paragraphs).toHaveLength(1);
        expect(letter.subject).toBe("Bewerbung als Designerin");
        expect(letter.lastResolved?.sender.name).toBe("Amina Hodzic");
        expect(await getLetter(letter.id)).toEqual(letter);
    });

    it("refuses to create a letter for a CV that does not exist", async () => {
        await expect(createLetterRecord("missing")).rejects.toThrow();
    });

    it("saves edits and moves updatedAt forward", async () => {
        const cv = await seedCv();
        const created = await createLetterRecord(cv.id!, { now: 1000 });
        const result = await saveLetter({ ...created, company: "Globex" }, created.updatedAt, 5000);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.letter.company).toBe("Globex");
        expect(result.letter.updatedAt).toBe(5000);
        expect((await getLetter(created.id))?.company).toBe("Globex");
    });

    it("returns a conflict instead of overwriting when another tab saved in between", async () => {
        const cv = await seedCv();
        const created = await createLetterRecord(cv.id!, { now: 1000 });
        const other = await saveLetter({ ...created, company: "Other tab" }, created.updatedAt, 2000);
        expect(other.ok).toBe(true);

        const mine = await saveLetter({ ...created, company: "My tab" }, created.updatedAt, 3000);
        expect(mine.ok).toBe(false);
        if (mine.ok) return;
        expect(mine.conflict?.company).toBe("Other tab");
        expect((await getLetter(created.id))?.company).toBe("Other tab");
    });

    it("refreshes the last-resolved cache from the CV on each save", async () => {
        const cv = await seedCv();
        const created = await createLetterRecord(cv.id!);
        await db.resumes.put({ ...cv, basics: { ...cv.basics, phone: "+49 99" } });
        const saved = await saveLetter(created, created.updatedAt);
        expect(saved.ok && saved.letter.lastResolved?.sender.phone).toBe("+49 99");
    });

    it("keeps the cache when the CV is gone", async () => {
        const cv = await seedCv();
        const created = await createLetterRecord(cv.id!);
        await db.resumes.delete(cv.id!);
        const saved = await saveLetter({ ...created, company: "X" }, created.updatedAt);
        expect(saved.ok && saved.letter.lastResolved?.sender.name).toBe("Amina Hodzic");
    });

    it("deletes a letter and restores the identical row", async () => {
        const cv = await seedCv();
        const created = await createLetterRecord(cv.id!);
        const row = await deleteLetter(created.id);
        expect(await getLetter(created.id)).toBeNull();
        await restoreLetter(row!);
        expect(await db.coverLetters.get(created.id)).toEqual(row);
    });

    it("lists newest first and skips rows that no longer parse without deleting them", async () => {
        await db.coverLetters.bulkPut([
            makeLetter({ id: "old", updatedAt: 1 }),
            makeLetter({ id: "new", updatedAt: 9 }),
            { id: "broken", updatedAt: 5, status: "draft", cvId: null } as never,
        ]);
        expect((await listLetters()).map((letter) => letter.id)).toEqual(["new", "old"]);
        expect(await db.coverLetters.count()).toBe(3);
    });

    it("reads a CV row saved before newer settings existed", async () => {
        const cv = await seedCv();
        const legacy = JSON.parse(JSON.stringify(cv));
        delete legacy.settings.interestsSection;
        await db.resumes.put(legacy);
        expect((await loadCv(cv.id!))?.basics.name).toBe("Amina Hodzic");
    });
});

describe("re-pointing and duplicating", () => {
    beforeEach(async () => {
        await resetLetterTables();
    });

    it("moves a draft to another CV: only the link changes and everything bound to the CV follows", async () => {
        await db.resumes.bulkPut([makeCv({ id: "cv-a", name: "First Person" }), makeCv({ id: "cv-b", name: "Second Person", phone: "+1 555" })]);
        const created = await createLetterRecord("cv-a", { company: "Acme", role: "Designer" });
        const withText = (await saveLetter({ ...created, paragraphs: [{ id: "p", markdown: "Keep this", prompt: "" }], recipient: { name: "Jane", address: "" } }, created.updatedAt)) as { ok: true; letter: typeof created };

        const { letter, keptOverrides } = await repointLetter(created.id, "cv-b");
        expect(letter.cvId).toBe("cv-b");
        expect(letter.paragraphs[0].markdown).toBe("Keep this");
        expect(letter.recipient.name).toBe("Jane");
        expect(letter.company).toBe("Acme");
        expect(letter.lastResolved?.sender.name).toBe("Second Person");
        expect(keptOverrides).toEqual([]);
        expect(letter.updatedAt).toBeGreaterThan(withText.letter.updatedAt);
    });

    it("keeps overrides when re-pointing and reports them", async () => {
        await db.resumes.bulkPut([makeCv({ id: "cv-a" }), makeCv({ id: "cv-b" })]);
        const created = await createLetterRecord("cv-a");
        await saveLetter({ ...created, senderOverrides: { email: "work@acme.test", phone: "1" } }, created.updatedAt);
        const { letter, keptOverrides } = await repointLetter(created.id, "cv-b");
        expect(letter.senderOverrides).toEqual({ email: "work@acme.test", phone: "1" });
        expect(keptOverrides.sort()).toEqual(["email", "phone"]);
    });

    it("refuses to re-point to a CV that does not exist, and refuses sent letters", async () => {
        await db.resumes.put(makeCv({ id: "cv-a" }));
        const created = await createLetterRecord("cv-a");
        await expect(repointLetter(created.id, "ghost")).rejects.toMatchObject({ code: "cv-missing" });
        await db.coverLetters.put(makeSentLetter({ id: "sent" }));
        await expect(repointLetter("sent", "cv-a")).rejects.toBeInstanceOf(LetterOperationError);
        await expect(repointLetter("sent", "cv-a")).rejects.toMatchObject({ code: "not-draft" });
        await expect(repointLetter("nope", "cv-a")).rejects.toMatchObject({ code: "not-found" });
    });

    it("duplicates into a new draft with a new id, the same content and the same CV, leaving the original alone", async () => {
        await db.resumes.put(makeCv({ id: "cv-a" }));
        const created = await createLetterRecord("cv-a", { company: "Acme", role: "Designer" });
        const saved = (await saveLetter({ ...created, paragraphs: [{ id: "p", markdown: "Body", prompt: "" }], senderOverrides: { email: "x@y.z" } }, created.updatedAt)) as { ok: true; letter: typeof created };

        const copy = await duplicateLetter(created.id, { copyLabel: "copy", now: new Date(2027, 0, 5, 12).getTime() });
        expect(copy.id).not.toBe(created.id);
        expect(copy).toMatchObject({ cvId: "cv-a", status: "draft", frozen: null, company: "Acme", date: "2027-01-05", title: "Acme - Designer (copy)" });
        expect(copy.paragraphs[0].markdown).toBe("Body");
        expect(copy.paragraphs[0].id).not.toBe("p");
        expect(copy.senderOverrides).toEqual({ email: "x@y.z" });
        expect(await getLetter(created.id)).toEqual(saved.letter);
    });

    it("duplicates into another CV, and a sent letter duplicates as a live draft", async () => {
        await db.resumes.bulkPut([makeCv({ id: "cv-a" }), makeCv({ id: "cv-b", name: "Other" })]);
        await db.coverLetters.put(makeSentLetter({ id: "sent", cvId: null }));
        await expect(duplicateLetter("sent", { copyLabel: "copy" })).rejects.toMatchObject({ code: "cv-missing" });

        const copy = await duplicateLetter("sent", { copyLabel: "copy", cvId: "cv-b" });
        expect(copy).toMatchObject({ cvId: "cv-b", status: "draft", frozen: null });
        expect(copy.lastResolved?.sender.name).toBe("Other");
        expect((await getLetter("sent"))?.status).toBe("sent");
    });
});

describe("deleting a CV with letters", () => {
    beforeEach(async () => {
        await resetLetterTables();
    });

    async function seedThree() {
        await db.resumes.bulkPut([makeCv({ id: "cv-1" }), makeCv({ id: "cv-2", name: "Other" })]);
        const d1 = await createLetterRecord("cv-1", { company: "A" });
        const d2 = await createLetterRecord("cv-1", { company: "B" });
        await db.coverLetters.put(makeSentLetter({ id: "sent", cvId: "cv-1" }));
        return { d1, d2 };
    }

    it("never changes the number of letters, whatever is chosen", async () => {
        const { d1, d2 } = await seedThree();
        await deleteCvWithLetters("cv-1", [{ letterId: d1.id, action: "link", cvId: "cv-2" }, { letterId: d2.id, action: "snapshot" }]);

        expect(await db.coverLetters.count()).toBe(3);
        expect(await db.resumes.get("cv-1")).toBeUndefined();
        expect(await getLetter(d1.id)).toMatchObject({ status: "draft", cvId: "cv-2" });
        expect(await getLetter(d2.id)).toMatchObject({ status: "snapshot", cvId: null });
        expect(await getLetter("sent")).toMatchObject({ status: "sent", cvId: null });
    });

    it("keeps a sent letter readable and unchanged after its CV is deleted", async () => {
        await seedThree();
        const before = await getLetter("sent");
        await deleteCvWithLetters("cv-1", (await listLetters()).filter((letter) => letter.status === "draft").map((letter) => ({ letterId: letter.id, action: "snapshot" as const })));
        const after = await getLetter("sent");
        expect(after?.frozen).toEqual(before?.frozen);
        expect(after?.paragraphs).toEqual(before?.paragraphs);
    });

    it("changes nothing when a draft has no decision", async () => {
        const { d1 } = await seedThree();
        await expect(deleteCvWithLetters("cv-1", [{ letterId: d1.id, action: "snapshot" }])).rejects.toThrow();
        expect(await db.resumes.get("cv-1")).toBeDefined();
        expect(await getLetter(d1.id)).toMatchObject({ status: "draft", cvId: "cv-1" });
        expect(await db.coverLetters.count()).toBe(3);
    });

    it("changes nothing when a link points at a CV that does not exist, or at the CV being deleted", async () => {
        const { d1, d2 } = await seedThree();
        await expect(deleteCvWithLetters("cv-1", [{ letterId: d1.id, action: "link", cvId: "ghost" }, { letterId: d2.id, action: "snapshot" }])).rejects.toMatchObject({ code: "cv-missing" });
        await expect(deleteCvWithLetters("cv-1", [{ letterId: d1.id, action: "link", cvId: "cv-1" }, { letterId: d2.id, action: "snapshot" }])).rejects.toMatchObject({ code: "cv-missing" });
        expect(await db.resumes.get("cv-1")).toBeDefined();
        expect((await getLetter(d2.id))?.status).toBe("draft");
    });

    it("rolls back the letters too when the CV cannot be deleted", async () => {
        const { d1, d2 } = await seedThree();
        const spy = vi.spyOn(db.resumes, "delete").mockRejectedValueOnce(new Error("disk full"));
        await expect(deleteCvWithLetters("cv-1", [{ letterId: d1.id, action: "link", cvId: "cv-2" }, { letterId: d2.id, action: "snapshot" }])).rejects.toThrow();
        spy.mockRestore();

        expect(await db.resumes.get("cv-1")).toBeDefined();
        expect(await getLetter(d1.id)).toMatchObject({ status: "draft", cvId: "cv-1" });
        expect(await getLetter(d2.id)).toMatchObject({ status: "draft", cvId: "cv-1" });
        expect(await getLetter("sent")).toMatchObject({ status: "sent", cvId: "cv-1" });
    });

    it("leaves a CV with no letters on the plain path", async () => {
        await db.resumes.put(makeCv({ id: "lonely" }));
        await deleteCvWithLetters("lonely", []);
        expect(await db.resumes.get("lonely")).toBeUndefined();
    });
});

describe("copying letters and converting to a snapshot", () => {
    beforeEach(async () => {
        await resetLetterTables();
    });

    it("copies every letter of a CV onto another as live drafts, overrides kept, titles unchanged", async () => {
        await db.resumes.bulkPut([makeCv({ id: "cv-1" }), makeCv({ id: "cv-2", name: "Copy Owner" })]);
        const one = await createLetterRecord("cv-1", { company: "A", role: "R" });
        await saveLetter({ ...one, title: "My title", senderOverrides: { email: "x@y.z" } }, one.updatedAt);
        await db.coverLetters.put(makeSentLetter({ id: "sent", cvId: "cv-1" }));

        const copies = await copyLettersToCv("cv-1", "cv-2");
        expect(copies).toHaveLength(2);
        expect(copies.every((copy) => copy.cvId === "cv-2" && copy.status === "draft" && copy.frozen === null)).toBe(true);
        expect(copies.map((copy) => copy.title).sort()).toEqual(["", "My title"]);
        expect(copies.find((copy) => copy.title === "My title")?.senderOverrides).toEqual({ email: "x@y.z" });
        expect(await db.coverLetters.count()).toBe(4); // the originals stay with the original CV
        expect((await listLettersForCv("cv-1"))).toHaveLength(2);
    });

    it("refuses to copy onto a CV that does not exist", async () => {
        await expect(copyLettersToCv("cv-1", "ghost")).rejects.toMatchObject({ code: "cv-missing" });
    });

    it("converts a draft whose CV is gone into a snapshot of what it last showed", async () => {
        await db.resumes.put(makeCv({ id: "cv-1", name: "Last Seen" }));
        const letter = await createLetterRecord("cv-1");
        await db.resumes.delete("cv-1");
        const snap = await convertToSnapshot(letter.id);
        expect(snap).toMatchObject({ status: "snapshot", cvId: null });
        expect(snap.frozen?.sender.name).toBe("Last Seen");
        await expect(convertToSnapshot(letter.id)).rejects.toMatchObject({ code: "not-draft" });
    });
});

describe("the paragraph library", () => {
    beforeEach(async () => {
        await resetLetterTables();
    });

    it("saves, lists newest first, renames, edits and deletes entries", async () => {
        const first = await saveParagraph({ name: "Availability", markdown: "I can start in March." }, 100);
        const second = await saveParagraph({ name: "Relocation", markdown: "I am happy to relocate." }, 200);
        expect((await listParagraphs()).map((entry) => entry.name)).toEqual(["Relocation", "Availability"]);

        const edited = await saveParagraph({ id: first.id, name: "Start date", markdown: "I can start in April." }, 300);
        expect(edited).toMatchObject({ id: first.id, name: "Start date", markdown: "I can start in April.", createdAt: 100, updatedAt: 300 });
        expect((await listParagraphs()).map((entry) => entry.name)).toEqual(["Start date", "Relocation"]);

        await deleteParagraph(second.id);
        expect((await listParagraphs()).map((entry) => entry.id)).toEqual([first.id]);
    });

    it("names an unnamed entry after the first words of its text", async () => {
        const entry = await saveParagraph({ name: "  ", markdown: "I would be glad to talk about how I could help your team grow this year." });
        expect(entry.name).toBe("I would be glad to talk about how I coul");
    });

    it("is independent of letters: a change or deletion never reaches a letter that used the text", async () => {
        await db.resumes.put(makeCv());
        const letter = await createLetterRecord("cv-1");
        const entry = await saveParagraph({ name: "Closing line", markdown: "Thank you for your time." });
        // Inserting copies the text into the letter.
        await saveLetter({ ...letter, paragraphs: [{ id: "p", markdown: entry.markdown, prompt: "" }] }, letter.updatedAt);

        await saveParagraph({ id: entry.id, name: "Closing line", markdown: "Changed in the library." });
        expect((await getLetter(letter.id))?.paragraphs[0].markdown).toBe("Thank you for your time.");
        await deleteParagraph(entry.id);
        expect((await getLetter(letter.id))?.paragraphs[0].markdown).toBe("Thank you for your time.");
    });
});

describe("CVs the strict schema rejects", () => {
    beforeEach(async () => {
        await resetLetterTables();
    });

    /** What the editor opens by merging onto defaults: an invalid email, an odd settings block, missing sections. */
    function oddCv() {
        const cv = JSON.parse(JSON.stringify(makeCv({ id: "odd", name: "Master Person" })));
        cv.basics.email = "not-an-email";
        cv.basics.emails = [{ id: "e", email: "also bad", label: "" }];
        cv.settings.typography = { fontFamily: "Lora" };
        delete cv.settings.header;
        delete cv.experience;
        return cv;
    }

    it("still reads such a CV, so a letter can be created for it", async () => {
        await db.resumes.put(oddCv());
        const cv = await loadCv("odd");
        expect(cv?.basics.name).toBe("Master Person");
        expect(cv?.basics.email).toBe("not-an-email");
        expect(cv?.settings.typography.fontFamily).toBe("Lora");

        const letter = await createLetterRecord("odd", { company: "Acme" });
        expect(letter).toMatchObject({ cvId: "odd", status: "draft" });
        expect(letter.lastResolved?.sender.name).toBe("Master Person");
        expect(letter.lastResolved?.design.fontFamily).toBe("Lora");
    });

    it("can mark such a letter sent and delete the CV with it", async () => {
        await db.resumes.put(oddCv());
        const letter = await createLetterRecord("odd");
        await markSent(letter.id);
        expect((await getLetter(letter.id))?.status).toBe("sent");
        await deleteCvWithLetters("odd", []);
        expect(await getLetter(letter.id)).toMatchObject({ status: "sent", cvId: null });
    });

    it("still refuses a CV that is not there, or a row that is not an object", async () => {
        expect(await loadCv("ghost")).toBeNull();
        await db.resumes.put("not an object" as never).catch(() => undefined);
        await expect(createLetterRecord("ghost")).rejects.toThrow();
    });
});
