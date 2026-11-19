import { describe, expect, it } from "vitest";
import { makeLetter, makeSentLetter } from "../../../test/setup/letter-fixtures";
import { MANGLES } from "../../../test/setup/workspace-fixtures";
import { letterFileText, parseLetterText, toLetterFile } from "./file-format";

const options = { hideContact: false, cvTitle: "Master CV" };

describe("letter file format", () => {
    const letter = makeLetter({
        id: "l-1",
        cvId: "cv-1",
        title: "Acme note",
        company: "Acme",
        role: "Designer",
        subject: "Application for Designer",
        senderOverrides: { email: "work@example.com" },
        designOverrides: { accentColor: "#123456" },
    });

    it("writes the readable form with the CV id and a title hint", () => {
        const file = toLetterFile(letter, options);
        expect(file).toMatchObject({ format: "enginecv.letter/v1", id: "l-1", status: "draft", cv: { id: "cv-1", title: "Master CV" }, standalone: false, company: "Acme", role: "Designer" });
        expect(file.paragraphs).toEqual(["I am **excited** to apply as {{role}}."]); // tokens stay tokens
        expect(file.sender).toEqual({ email: "work@example.com" });
        expect(file.design).toEqual({ accentColor: "#123456" });
        expect(Object.keys(file).slice(0, 4)).toEqual(["$schema", "format", "id", "status"]);
    });

    it("leaves frozen snapshots, caches and timestamps out", () => {
        const text = letterFileText(makeSentLetter({ cvId: "cv-1", senderName: "Secret Name" }), options);
        expect(text).not.toContain("Secret Name");
        expect(text).not.toContain("amina@example.com");
        expect(text).not.toContain("base64");
        expect(JSON.parse(text).status).toBe("sent");
    });

    it("writes a standalone letter without a CV link, and leaves the sender out when contact details are hidden", () => {
        const solo = makeLetter({ cvId: null, standalone: true, senderOverrides: { name: "Sam", email: "sam@example.com" } });
        const shown = toLetterFile(solo, { hideContact: false });
        expect(shown.cv).toBeUndefined();
        expect(shown.standalone).toBe(true);
        expect(shown.sender).toEqual({ name: "Sam", email: "sam@example.com" });
        expect(toLetterFile(solo, { hideContact: true }).sender).toBeUndefined();
    });

    it("round-trips what it writes", () => {
        const parsed = parseLetterText(letterFileText(letter, options));
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;
        expect(parsed.id).toBe("l-1");
        expect(parsed.content).toMatchObject({ company: "Acme", cv: { id: "cv-1" }, sender: { email: "work@example.com" }, design: { accentColor: "#123456" } });
        expect(parsed.notices).toEqual([]);
    });

    it("distinguishes an omitted field from a cleared one", () => {
        const parsed = parseLetterText(JSON.stringify({ format: "enginecv.letter/v1", id: "l-1", company: "", role: undefined }));
        expect(parsed.ok && "company" in parsed.content && parsed.content.company === "").toBe(true);
        expect(parsed.ok && "role" in parsed.content).toBe(false);
    });

    it("ignores unknown keys with a notice", () => {
        const parsed = parseLetterText(JSON.stringify({ format: "enginecv.letter/v1", id: "l-1", company: "Acme", mood: "keen" }));
        expect(parsed.ok && parsed.notices.map((notice) => `${notice.code}:${notice.params.key}`)).toEqual(["unknown-field-skipped:mood"]);
    });

    it("repairs harmless slips with a notice", () => {
        const text = letterFileText(letter, options);
        for (const body of [`﻿${text}`, text.replace(/\n/g, "\r\n"), `\`\`\`json\n${text}\n\`\`\``, `Here you go:\n${text}\nCheers`]) {
            const parsed = parseLetterText(body);
            expect(parsed.ok && parsed.content.company).toBe("Acme");
        }
        expect(parseLetterText(`\`\`\`json\n${text}\n\`\`\``)).toMatchObject({ ok: true, notices: [{ code: "code-fence" }] });
    });

    it("blocks bad files with a reason", () => {
        expect(parseLetterText("")).toMatchObject({ ok: false, reason: { code: "empty" } });
        expect(parseLetterText("{ not json")).toMatchObject({ ok: false, reason: { code: "invalid-json" } });
        expect(parseLetterText("[1,2]")).toMatchObject({ ok: false, reason: { code: "no-document" } });
        expect(parseLetterText(JSON.stringify({ format: "enginecv.letter/v1" }))).toMatchObject({ ok: false, reason: { code: "no-document" } });
        expect(parseLetterText(JSON.stringify({ format: "enginecv.letter/v2", company: "x" }))).toMatchObject({ ok: false, reason: { code: "newer-version" } });
        expect(parseLetterText(JSON.stringify({ format: "enginecv.authoring/v1", company: "x" }))).toMatchObject({ ok: false, reason: { code: "no-document" } });
        expect(parseLetterText(JSON.stringify({ format: "enginecv.letter/v1", paragraphs: "not a list" }))).toMatchObject({ ok: false, reason: { code: "invalid-field", detail: "paragraphs" } });
        expect(parseLetterText(JSON.stringify({ format: "enginecv.letter/v1", layout: "fancy" }))).toMatchObject({ ok: false, reason: { code: "invalid-field", detail: "layout" } });
    });

    it("accepts a file with no format key, as agents often omit it", () => {
        expect(parseLetterText(JSON.stringify({ company: "Acme", cv: { id: "cv-1" } }))).toMatchObject({ ok: true });
    });

    it("never accepts a cut-off file", () => {
        const text = letterFileText(letter, options);
        const accepted: number[] = [];
        for (let cut = 0; cut < text.length - 1; cut += 3) if (parseLetterText(text.slice(0, cut)).ok) accepted.push(cut);
        expect(accepted).toEqual([]);
    });

    describe("cut-off and mangled files (the same property as the CV's)", () => {
        const full = makeLetter({
            id: "l-full",
            cvId: "cv-1",
            title: "Full letter",
            company: "Acme",
            role: "Designer",
            subject: "Application for Designer",
            recipient: { name: "Jane Doe", address: "Acme GmbH\nMusterstr. 1\n10115 Berlin" },
            paragraphs: Array.from({ length: 6 }, (_, index) => ({ id: `p${index}`, markdown: `Paragraph ${index} with **bold** and a {{company}} token and some more words to make it long.`, prompt: "" })),
            senderOverrides: { email: "work@example.com", phone: "+49 30 1234567" },
            designOverrides: { accentColor: "#123456" },
        });
        const text = letterFileText(full, options);

        it("blocks the file at every single cut-off point", () => {
            const accepted: number[] = [];
            for (let cut = 0; cut < text.length - 1; cut += 1) if (parseLetterText(text.slice(0, cut)).ok) accepted.push(cut);
            expect(accepted).toEqual([]);
        }, 30_000);

        it("repairs the harmless slips, keeping the same content, and says so", () => {
            const expected = JSON.stringify(toLetterFile(full, options).paragraphs);
            for (const [name, mangle] of Object.entries(MANGLES)) {
                const result = parseLetterText(mangle(text));
                expect(result.ok, name).toBe(true);
                if (result.ok) expect(JSON.stringify(result.content.paragraphs), name).toBe(expected);
            }
        });

        it("blocks what loses structure: single quotes, empty and blank text", () => {
            expect(parseLetterText(text.replace(/"/g, "'")).ok).toBe(false);
            expect(parseLetterText("")).toMatchObject({ ok: false, reason: { code: "empty" } });
            expect(parseLetterText("  \n ").ok).toBe(false);
        });
    });
});
