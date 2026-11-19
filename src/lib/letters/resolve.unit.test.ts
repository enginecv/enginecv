import { describe, expect, it } from "vitest";
import { makeCv, makeLetter, makeSentLetter } from "../../../test/setup/letter-fixtures";
import { buildLastResolved, resolveLetter } from "./resolve";

describe("resolveLetter: drafts follow the CV", () => {
    it("takes sender, design and token values from the CV", () => {
        const cv = makeCv({ accent: "#112233" });
        const resolved = resolveLetter(makeLetter(), cv);
        expect(resolved.sender.name).toBe("Amina Hodzic");
        expect(resolved.design.accentColor).toBe("#112233");
        expect(resolved.tokenValues.role).toBe("Senior Product Designer");
        expect(resolved.paragraphs[0].markdown).toBe("I am **excited** to apply as Senior Product Designer.");
        expect(resolved.frozen).toBe(false);
    });

    it("changes when, and only when, the CV changes", () => {
        const letter = makeLetter();
        const cv = makeCv();
        const before = resolveLetter(letter, cv);
        expect(resolveLetter(letter, makeCv())).toEqual(before);
        const after = resolveLetter(letter, makeCv({ phone: "+49 1" }));
        expect(after.sender.phone).toBe("+49 1");
        expect(after.paragraphs).toEqual(before.paragraphs);
    });

    it("never lets a CV change touch the letter's own text", () => {
        const letter = makeLetter();
        const resolved = resolveLetter(letter, makeCv({ name: "Someone Else", headline: "Other" }));
        expect(resolved.company).toBe("Acme");
        expect(resolved.recipient).toEqual(letter.recipient);
        expect(resolved.salutation).toBe("Dear Hiring Team,");
        expect(resolved.closing).toBe("Kind regards,");
    });

    it("applies overrides, marks them, and keeps them when the CV changes", () => {
        const letter = makeLetter({ senderOverrides: { email: "work@acme.test" } });
        const first = resolveLetter(letter, makeCv());
        const second = resolveLetter(letter, makeCv({ email: "new@example.com" }));
        expect(first.sender.email).toBe("work@acme.test");
        expect(second.sender.email).toBe("work@acme.test");
        expect(second.overridden).toEqual(["email"]);
    });

    it("shows the photo only when the letter asks for it", () => {
        const cv = makeCv({ photo: "data:image/png;base64,AAA" });
        expect(resolveLetter(makeLetter(), cv).photo).toBe("");
        expect(resolveLetter(makeLetter({ showPhoto: true }), cv).photo).toBe("data:image/png;base64,AAA");
        expect(resolveLetter(makeLetter({ showPhoto: true }), makeCv()).warnings).toContainEqual({ code: "photo-unavailable" });
    });

    it("warns about missing sender fields and unresolved tokens, once per token", () => {
        const cv = makeCv({ name: "", email: "", headline: "" });
        const letter = makeLetter({ paragraphs: [{ id: "a", markdown: "{{role}} and {{role}}", prompt: "" }, { id: "b", markdown: "{{skills}}", prompt: "" }] });
        const warnings = resolveLetter(letter, { ...cv, skillGroups: [] }).warnings;
        expect(warnings).toContainEqual({ code: "missing-sender-field", detail: "name" });
        expect(warnings).toContainEqual({ code: "missing-sender-field", detail: "email" });
        expect(warnings.filter((warning) => warning.code === "unresolved-token").map((warning) => warning.detail)).toEqual(["role", "skills"]);
    });

    it("leaves no token syntax in any resolved text", () => {
        const letter = makeLetter({ subject: "Application as {{role}}", paragraphs: [{ id: "a", markdown: "{{name}} {{nothing}}", prompt: "" }] });
        const resolved = resolveLetter(letter, makeCv());
        const text = JSON.stringify([resolved.subject, resolved.paragraphs.map((paragraph) => paragraph.markdown)]);
        expect(text).not.toContain("{{");
        expect(resolved.subject).toBe("Application as Senior Product Designer");
    });

    it("hands the preview chip-marked text while exports get plain text", () => {
        const resolved = resolveLetter(makeLetter(), makeCv());
        expect(resolved.paragraphs[0].previewMarkdown).not.toBe(resolved.paragraphs[0].markdown);
        expect(resolved.paragraphs[0].previewMarkdown).toContain("Senior Product Designer");
    });
});

describe("resolveLetter: frozen letters ignore the CV", () => {
    it("is identical before and after any CV edit or deletion", () => {
        const letter = makeSentLetter({ senderName: "Amina Hodzic" });
        const a = resolveLetter(letter, makeCv());
        const b = resolveLetter(letter, makeCv({ name: "Renamed", accent: "#ff0000", phone: "0", headline: "Other" }));
        const c = resolveLetter(letter, null);
        expect(b).toEqual(a);
        expect(c).toEqual(a);
        expect(a.frozen).toBe(true);
        expect(a.sender.name).toBe("Amina Hodzic");
        expect(a.tokenValues.role).toBe("Senior Product Designer");
    });
});

describe("resolveLetter: a draft whose CV is missing", () => {
    it("falls back to the last-resolved cache and warns", () => {
        const cv = makeCv({ name: "Cached Name" });
        const lastResolved = buildLastResolved(makeLetter(), cv, 5);
        const resolved = resolveLetter(makeLetter({ lastResolved }), null);
        expect(resolved.sender.name).toBe("Cached Name");
        expect(resolved.warnings).toContainEqual({ code: "cv-missing" });
    });

    it("still resolves with no cache at all", () => {
        const resolved = resolveLetter(makeLetter(), null);
        expect(resolved.sender.name).toBe("");
        expect(resolved.warnings.map((warning) => warning.code)).toContain("cv-missing");
    });
});
