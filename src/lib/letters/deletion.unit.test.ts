import { describe, expect, it } from "vitest";
import { makeCv, makeLetter, makeSentLetter } from "../../../test/setup/letter-fixtures";
import { MissingDecisionError, applyDeletionDecisions, planCvDeletion, snapshotLetter } from "./deletion";
import { buildLastResolved, resolveLetter } from "./resolve";

const withCache = (overrides = {}) => {
    const letter = makeLetter(overrides);
    return { ...letter, lastResolved: buildLastResolved(letter, makeCv({ name: "Cached Name" }), 5) };
};

describe("planCvDeletion", () => {
    it("separates frozen letters from drafts and ignores other CVs' letters", () => {
        const letters = [makeLetter({ id: "d1" }), makeSentLetter({ id: "s1" }), makeLetter({ id: "d2", cvId: "other" }), makeSentLetter({ id: "s2", cvId: "other" })];
        const plan = planCvDeletion(letters, "cv-1");
        expect(plan.drafts.map((letter) => letter.id)).toEqual(["d1"]);
        expect(plan.frozen.map((letter) => letter.id)).toEqual(["s1"]);
    });

    it("is empty for a CV with no letters", () => {
        expect(planCvDeletion([makeLetter({ cvId: "other" })], "cv-1")).toEqual({ frozen: [], drafts: [] });
    });
});

describe("snapshotLetter", () => {
    it("freezes what the draft last showed, without its CV, and is not marked as sent", () => {
        const snap = snapshotLetter(withCache({ senderOverrides: { email: "work@acme.test" } }), 50);
        expect(snap).toMatchObject({ status: "snapshot", cvId: null, lastResolved: null });
        expect(snap.frozen?.sender.name).toBe("Cached Name");
        expect(snap.frozen?.tokens.role).toBe("Senior Product Designer");
        expect(snap.frozen?.at).toBe(50);
    });

    it("resolves to the same text and sender afterwards, with no CV", () => {
        const draft = withCache();
        const before = resolveLetter(draft, makeCv({ name: "Cached Name" }));
        const after = resolveLetter(snapshotLetter(draft, 9), null);
        expect(after.sender).toEqual(before.sender);
        expect(after.paragraphs.map((paragraph) => paragraph.markdown)).toEqual(before.paragraphs.map((paragraph) => paragraph.markdown));
    });

    it("still produces a valid letter when the draft has no cache", () => {
        expect(snapshotLetter(makeLetter(), 9).status).toBe("snapshot");
    });
});

describe("applyDeletionDecisions", () => {
    const plan = () => planCvDeletion([makeLetter({ id: "d1" }), makeLetter({ id: "d2" }), makeSentLetter({ id: "s1" })], "cv-1");

    it("links a draft to another CV, snapshots another, and unlinks the sent one without changing its content", () => {
        const updated = applyDeletionDecisions(plan(), [{ letterId: "d1", action: "link", cvId: "cv-2" }, { letterId: "d2", action: "snapshot" }], 100);
        const byId = new Map(updated.map((letter) => [letter.id, letter]));
        expect(byId.get("d1")).toMatchObject({ status: "draft", cvId: "cv-2" });
        expect(byId.get("d2")).toMatchObject({ status: "snapshot", cvId: null });
        expect(byId.get("s1")).toMatchObject({ status: "sent", cvId: null });
        expect(byId.get("s1")?.frozen).toEqual(makeSentLetter({ id: "s1" }).frozen);
        expect(updated).toHaveLength(3);
    });

    it("throws when a draft has no decision, so a half-resolved deletion cannot go ahead", () => {
        expect(() => applyDeletionDecisions(plan(), [{ letterId: "d1", action: "snapshot" }], 1)).toThrow(MissingDecisionError);
    });

    it("needs no decisions when there are no drafts", () => {
        const onlySent = planCvDeletion([makeSentLetter({ id: "s1" })], "cv-1");
        expect(applyDeletionDecisions(onlySent, [], 1)).toHaveLength(1);
    });
});
