import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { makeCv, makeLetter, resetLetterTables } from "../../../test/setup/letter-fixtures";
import { DEFAULT_LETTER_DESIGN, applyDesignOverrides, pickLetterDesign } from "./design";
import { remapLetters } from "./import";
import { resolveLetter } from "./resolve";
import { createStandaloneLetter, letterDocumentSchema } from "./schema";
import { createStandaloneLetterRecord, duplicateLetter, getLetter, markSent, repointLetter, unfreeze } from "./store";

describe("letters without a CV", () => {
    beforeEach(async () => {
        await resetLetterTables();
    });

    it("is a valid draft only when marked standalone, and never with a CV", () => {
        expect(letterDocumentSchema.safeParse({ cvId: null, standalone: true }).success).toBe(true);
        expect(letterDocumentSchema.safeParse({ cvId: null, standalone: false }).success).toBe(false); // an orphan is not standalone
        expect(letterDocumentSchema.safeParse({ cvId: "cv-1", standalone: true }).success).toBe(false);
    });

    it("starts from the language's starter content and the German layout for German", async () => {
        const letter = await createStandaloneLetterRecord({ language: "de", role: "Designerin" });
        expect(letter).toMatchObject({ cvId: null, standalone: true, status: "draft", layout: "din5008", paperSize: "a4", subject: "Bewerbung als Designerin" });
        expect(await getLetter(letter.id)).toEqual(letter);
    });

    it("prints what the person typed, the default design, and only the name token", () => {
        const letter = { ...createStandaloneLetter({ language: "en" }), paragraphs: [{ id: "p", markdown: "{{name}} as {{role}}", prompt: "" }], senderOverrides: { name: "Sam Sender", email: "sam@example.com" }, designOverrides: { accentColor: "#ff0000" } };
        const resolved = resolveLetter(letterDocumentSchema.parse(letter), null);
        expect(resolved.standalone).toBe(true);
        expect(resolved.sender).toMatchObject({ name: "Sam Sender", email: "sam@example.com", signatureName: "Sam Sender" });
        expect(resolved.overridden).toEqual([]);
        expect(resolved.design).toEqual({ ...DEFAULT_LETTER_DESIGN, accentColor: "#ff0000" });
        expect(resolved.designOverridden).toEqual(["accentColor"]);
        expect(resolved.paragraphs[0].markdown).toBe("Sam Sender as ");
        expect(resolved.warnings.map((warning) => warning.code)).not.toContain("cv-missing");
        expect(resolved.warnings).toContainEqual({ code: "unresolved-token", detail: "role" });
    });

    it("warns about missing sender details like any letter", () => {
        const resolved = resolveLetter(createStandaloneLetter({ language: "en" }), null);
        expect(resolved.warnings.filter((warning) => warning.code === "missing-sender-field").map((warning) => warning.detail)).toEqual(["name", "email"]);
    });

    it("freezes on send without a CV, and unfreezes back to a standalone draft", async () => {
        const created = await createStandaloneLetterRecord({ language: "en" });
        await db.coverLetters.put({ ...created, senderOverrides: { name: "Sam Sender", email: "sam@example.com" } });
        const sent = await markSent(created.id);
        expect(sent).toMatchObject({ status: "sent", standalone: true, cvId: null });
        expect(sent.frozen?.sender.name).toBe("Sam Sender");
        expect(resolveLetter(sent, null).sender.name).toBe("Sam Sender");

        const draft = await unfreeze(created.id);
        expect(draft).toMatchObject({ status: "draft", standalone: true, cvId: null, frozen: null });
    });

    it("duplicates as a standalone letter, or into a CV", async () => {
        const created = await createStandaloneLetterRecord({ language: "en", company: "Acme" });
        const copy = await duplicateLetter(created.id, { copyLabel: "copy" });
        expect(copy).toMatchObject({ standalone: true, cvId: null, company: "Acme" });

        await db.resumes.put(makeCv({ id: "cv-a" }));
        const linked = await duplicateLetter(created.id, { cvId: "cv-a", copyLabel: "" });
        expect(linked).toMatchObject({ standalone: false, cvId: "cv-a" });
    });

    it("links to a CV later, which takes over the design except what the person changed", async () => {
        await db.resumes.put(makeCv({ id: "cv-a", accent: "#00aa00", fontFamily: "Lora" }));
        const created = await createStandaloneLetterRecord({ language: "en" });
        await db.coverLetters.put({ ...created, designOverrides: { fontFamily: "Roboto" } });

        const { letter } = await repointLetter(created.id, "cv-a");
        expect(letter).toMatchObject({ standalone: false, cvId: "cv-a" });
        const cv = makeCv({ id: "cv-a", accent: "#00aa00", fontFamily: "Lora" });
        const resolved = resolveLetter(letter, cv);
        expect(resolved.design.accentColor).toBe("#00aa00");
        expect(resolved.design.fontFamily).toBe("Roboto");
        expect(resolved.designOverridden).toEqual(["fontFamily"]);
    });

    it("stays standalone through a data export and import, unlike a letter that lost its CV", () => {
        const solo = makeLetter({ id: "s", cvId: null, standalone: true });
        const orphan = makeLetter({ id: "o", cvId: "gone" });
        const result = remapLetters([solo, orphan], new Map());
        expect(result.letters[0]).toMatchObject({ standalone: true, cvId: null });
        expect(result.letters[1].cvId).toMatch(/^missing:/);
        expect(result.orphanedDrafts).toBe(1);
    });
});

describe("design overrides on a letter with a CV", () => {
    it("start from the CV's design and win over it", () => {
        const cv = makeCv({ accent: "#00aa00", fontFamily: "Lora" });
        const base = pickLetterDesign(cv.settings);
        expect(base).toMatchObject({ accentColor: "#00aa00", fontFamily: "Lora" });
        expect(applyDesignOverrides(base, { fontSize: 12 })).toMatchObject({ accentColor: "#00aa00", fontSize: 12 });

        const letter = makeLetter({ designOverrides: { accentColor: "#123456" } });
        const resolved = resolveLetter(letter, cv);
        expect(resolved.design).toMatchObject({ accentColor: "#123456", fontFamily: "Lora" });
        expect(resolved.designOverridden).toEqual(["accentColor"]);
    });

    it("never change the CV", () => {
        const cv = makeCv({ accent: "#00aa00" });
        const before = JSON.stringify(cv);
        resolveLetter(makeLetter({ designOverrides: { accentColor: "#123456" } }), cv);
        expect(JSON.stringify(cv)).toBe(before);
    });
});
