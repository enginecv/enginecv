import { describe, expect, it } from "vitest";
import { makeLetter, makeSentLetter } from "../../../test/setup/letter-fixtures";
import { MISSING_CV_PREFIX, parseLettersFromExport, remapLetters, remapParagraphs } from "./import";
import { paragraphEntrySchema } from "./schema";

describe("remapLetters", () => {
    it("gives every letter a new id and remaps its CV link", () => {
        const letters = [makeLetter({ id: "a", cvId: "old-1" }), makeLetter({ id: "b", cvId: "old-2" })];
        const { letters: out, orphanedDrafts } = remapLetters(letters, new Map([["old-1", "new-1"], ["old-2", "new-2"]]));
        expect(out.map((letter) => letter.cvId)).toEqual(["new-1", "new-2"]);
        expect(out.every((letter, index) => letter.id !== letters[index].id)).toBe(true);
        expect(new Set(out.map((letter) => letter.id)).size).toBe(2);
        expect(orphanedDrafts).toBe(0);
    });

    it("keeps a draft whose CV is not in the file, pointing at a link that matches no CV, and counts it", () => {
        const { letters, orphanedDrafts } = remapLetters([makeLetter({ id: "a", cvId: "gone" })], new Map());
        expect(orphanedDrafts).toBe(1);
        expect(letters[0].status).toBe("draft");
        expect(letters[0].cvId).toBe(`${MISSING_CV_PREFIX}gone`);
    });

    it("keeps sent and frozen letters whole and unlinks them when their CV is not in the file", () => {
        const sent = makeSentLetter({ id: "s", cvId: "gone" });
        const { letters, orphanedDrafts } = remapLetters([sent], new Map());
        expect(orphanedDrafts).toBe(0);
        expect(letters[0]).toMatchObject({ status: "sent", cvId: null });
        expect(letters[0].frozen).toEqual(sent.frozen);
    });

    it("keeps text, recipient, overrides and the cache exactly", () => {
        const original = makeLetter({ id: "a", cvId: "old", senderOverrides: { email: "x@y.z" }, recipient: { name: "Jane", address: "1 Main" } });
        const [letter] = remapLetters([original], new Map([["old", "new"]])).letters;
        expect(letter.paragraphs).toEqual(original.paragraphs);
        expect(letter.recipient).toEqual(original.recipient);
        expect(letter.senderOverrides).toEqual(original.senderOverrides);
    });
});

describe("remapParagraphs", () => {
    const entry = (name: string, markdown: string) => paragraphEntrySchema.parse({ name, markdown });

    it("adds new ids and skips what the library already holds", () => {
        const existing = [entry("Closing", "Thank you.")];
        const out = remapParagraphs([entry("Closing", "Thank you."), entry("Relocation", "Happy to move.")], existing);
        expect(out).toHaveLength(1);
        expect(out[0].name).toBe("Relocation");
    });

    it("does not add the same entry twice from one file", () => {
        expect(remapParagraphs([entry("A", "x"), entry("A", "x")], [])).toHaveLength(1);
    });
});

describe("parseLettersFromExport", () => {
    it("reads valid rows and skips ones that do not fit", () => {
        const parsed = parseLettersFromExport([makeLetter({ id: "ok" }), { id: "bad", status: "draft", cvId: null }], [{ name: "A", markdown: "x" }, 5]);
        expect(parsed.letters.map((letter) => letter.id)).toEqual(["ok"]);
        expect(parsed.paragraphs).toHaveLength(1);
    });

    it("returns nothing for a file without letters", () => {
        expect(parseLettersFromExport(undefined, undefined)).toEqual({ letters: [], paragraphs: [] });
    });
});
