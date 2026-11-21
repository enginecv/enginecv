import { describe, expect, it } from "vitest";
import { makeLetter, makeSentLetter } from "../../../test/setup/letter-fixtures";
import { applyLetterContent, letterFromContent } from "./apply-content";

describe("applyLetterContent", () => {
    const current = makeLetter({ id: "l-1", cvId: "cv-1", company: "Acme", role: "Designer", paragraphs: [{ id: "p1", markdown: "Old one", prompt: "hint" }, { id: "p2", markdown: "Old two", prompt: "" }], updatedAt: 10 });

    it("changes only the fields the file has", () => {
        const next = applyLetterContent(current, { company: "Globex" }, 50);
        expect(next.company).toBe("Globex");
        expect(next.role).toBe("Designer");
        expect(next.paragraphs).toEqual(current.paragraphs);
        expect(next.updatedAt).toBe(50);
        expect(next.id).toBe("l-1");
    });

    it("treats an empty string as cleared and an omitted field as unchanged", () => {
        const next = applyLetterContent(current, { company: "", recipient: { name: "Jane" } });
        expect(next.company).toBe("");
        expect(next.recipient.name).toBe("Jane");
        expect(next.recipient.address).toBe(current.recipient.address);
    });

    it("keeps paragraph ids and prompts by position and gives new paragraphs new ids", () => {
        const next = applyLetterContent(current, { paragraphs: ["First", "Second", "Third"] });
        expect(next.paragraphs.map((p) => p.markdown)).toEqual(["First", "Second", "Third"]);
        expect(next.paragraphs[0]).toMatchObject({ id: "p1", prompt: "hint" });
        expect(next.paragraphs[2].id).not.toBe("p1");
        expect(applyLetterContent(current, { paragraphs: ["Only"] }).paragraphs).toHaveLength(1);
    });

    it("replaces overrides as a set when the file has them", () => {
        const withOverrides = makeLetter({ cvId: "cv-1", senderOverrides: { email: "a@x.test" }, designOverrides: { fontSize: 12 } });
        const next = applyLetterContent(withOverrides, { sender: { phone: "123" }, design: { accentColor: "#111111" } });
        expect(next.senderOverrides).toEqual({ phone: "123" });
        expect(next.designOverrides).toEqual({ accentColor: "#111111" });
        expect(applyLetterContent(withOverrides, { company: "X" }).senderOverrides).toEqual({ email: "a@x.test" });
    });

    it("links to a CV by id, or makes the letter standalone", () => {
        expect(applyLetterContent(current, { cv: { id: "cv-2" } })).toMatchObject({ cvId: "cv-2", standalone: false });
        expect(applyLetterContent(current, { standalone: true })).toMatchObject({ cvId: null, standalone: true });
        expect(applyLetterContent(current, {}).cvId).toBe("cv-1");
    });

    it("keeps the German layout on A4 and remembers the size to come back to", () => {
        const letterSize = makeLetter({ cvId: "cv-1", paperSize: "letter" });
        const german = applyLetterContent(letterSize, { layout: "din5008" });
        expect(german).toMatchObject({ layout: "din5008", paperSize: "a4", paperSizeBeforeGerman: "letter" });
        expect(applyLetterContent(german, { paper: "letter" }).paperSize).toBe("a4");
    });

    it("never touches a sent letter's frozen snapshot, status or id", () => {
        const sent = makeSentLetter({ id: "s1", cvId: "cv-1" });
        const next = applyLetterContent(sent, { company: "Changed", status: "draft", id: "other" });
        expect(next.frozen).toEqual(sent.frozen);
        expect(next.status).toBe("sent");
        expect(next.id).toBe("s1");
    });

    it("builds a new letter from a file, standalone when it names no CV", () => {
        const fromFile = letterFromContent({ cv: { id: "cv-1" }, company: "Acme", paragraphs: ["Hello"] }, { id: "new-1", now: 5 });
        expect(fromFile).toMatchObject({ id: "new-1", cvId: "cv-1", standalone: false, company: "Acme", status: "draft", createdAt: 5 });
        expect(fromFile.paragraphs.map((p) => p.markdown)).toEqual(["Hello"]);
        expect(letterFromContent({ company: "Solo" }, { id: "new-2" })).toMatchObject({ cvId: null, standalone: true });
    });
});
