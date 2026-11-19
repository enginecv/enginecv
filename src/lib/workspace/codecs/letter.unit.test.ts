import { describe, expect, it } from "vitest";
import { makeLetter, makeSentLetter } from "../../../../test/setup/letter-fixtures";
import { createLetterCodec } from "./letter";

const codec = createLetterCodec({ cvTitle: (id) => (id === "cv-1" ? "Master CV" : undefined) });
const opts = { hideContact: false };
const ctx = { now: 1000, hideContact: false };

describe("letter codec", () => {
    it("round-trips a draft through its file text", () => {
        const letter = makeLetter({ id: "l-1", cvId: "cv-1", title: "Acme", company: "Acme", subject: "Hello" });
        const text = codec.serialize(letter, opts);
        expect(JSON.parse(text)).toMatchObject({ format: "enginecv.letter/v1", id: "l-1", cv: { id: "cv-1", title: "Master CV" }, company: "Acme" });
        const parsed = codec.parse(text, ctx);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.id).toBe("l-1");
        expect(codec.isSameContent(codec.apply(letter, parsed.doc, opts), letter)).toBe(true);
    });

    it("applies only what the file says: omitted fields stay, present empty strings clear", () => {
        const letter = makeLetter({ id: "l-1", cvId: "cv-1", company: "Acme", subject: "Keep me" });
        const parsed = codec.parse(JSON.stringify({ format: "enginecv.letter/v1", id: "l-1", company: "", role: "Designer" }), ctx);
        if (!parsed.ok) throw new Error("parse failed");
        const next = codec.apply(letter, parsed.doc, opts);
        expect(next.company).toBe("");
        expect(next.role).toBe("Designer");
        expect(next.subject).toBe("Keep me");
        expect(next.paragraphs).toEqual(letter.paragraphs);
        expect(next.id).toBe("l-1");
    });

    it("refuses to apply to a sent letter with the sent-letter reason", () => {
        expect(codec.canApplyExternal(makeSentLetter({ id: "l-2" }))).toEqual({ ok: false, reason: { code: "sent-letter" } });
        expect(codec.canApplyExternal(makeLetter({ id: "l-1", cvId: "cv-1" }))).toEqual({ ok: true });
    });

    it("counts paragraphs as entries", () => {
        expect(codec.entryCount(makeLetter({ id: "l-1", cvId: "cv-1" }))).toBeGreaterThan(0);
        const parsed = codec.parse(JSON.stringify({ format: "enginecv.letter/v1", paragraphs: ["a", "b", "c"] }), ctx);
        if (!parsed.ok) throw new Error("parse failed");
        expect(codec.entryCount(parsed.doc)).toBe(3);
    });

    it("keeps a link to an unknown CV (a draft that needs a CV) and standalone letters standalone", () => {
        const letter = makeLetter({ id: "l-1", cvId: "cv-1" });
        const linked = codec.parse(JSON.stringify({ format: "enginecv.letter/v1", cv: { id: "ghost" } }), ctx);
        if (!linked.ok) throw new Error("parse failed");
        expect(codec.apply(letter, linked.doc, opts)).toMatchObject({ cvId: "ghost", standalone: false });
        const alone = codec.parse(JSON.stringify({ format: "enginecv.letter/v1", standalone: true }), ctx);
        if (!alone.ok) throw new Error("parse failed");
        expect(codec.apply(letter, alone.doc, opts)).toMatchObject({ cvId: null, standalone: true });
    });

    it("ignores sender details in a file when contact details are left out", () => {
        const letter = makeLetter({ id: "l-1", cvId: "cv-1" });
        const parsed = codec.parse(JSON.stringify({ format: "enginecv.letter/v1", sender: { email: "agent@example.com" } }), ctx);
        if (!parsed.ok) throw new Error("parse failed");
        expect(codec.apply(letter, parsed.doc, { hideContact: true }).senderOverrides.email).toBeUndefined();
        expect(codec.apply(letter, parsed.doc, { hideContact: false }).senderOverrides.email).toBe("agent@example.com");
        expect(codec.serialize({ ...letter, senderOverrides: { email: "me@example.com" } }, { hideContact: true })).not.toContain("me@example.com");
    });

    it("blocks bad files without throwing and describes a paragraph change", () => {
        expect(codec.parse("{ half a fi", ctx)).toMatchObject({ ok: false });
        expect(codec.parse("", ctx)).toMatchObject({ ok: false, reason: { code: "empty" } });
        const before = makeLetter({ id: "l-1", cvId: "cv-1" });
        const parsed = codec.parse(JSON.stringify({ format: "enginecv.letter/v1", paragraphs: ["totally new"] }), ctx);
        if (!parsed.ok) throw new Error("parse failed");
        const after = codec.apply(before, parsed.doc, opts);
        const change = codec.describeChange(before, after);
        expect(change.changed + change.added + change.removed).toBeGreaterThan(0);
    });
});
