import { describe, expect, it } from "vitest";
import { createEmptyResume } from "@/lib/schema";
import { makeCv, makeLetter } from "../../../test/setup/letter-fixtures";
import { freezeLetter, sendWarnings, unfreezeLetter } from "./freeze";
import { resolveLetter } from "./resolve";

describe("freezeLetter", () => {
    it("stores the sender with overrides, the design, the token values and the CV title", () => {
        const cv = makeCv({ accent: "#123456", title: "Design CV" });
        const frozen = freezeLetter(makeLetter({ senderOverrides: { email: "work@acme.test" } }), cv, 50);
        expect(frozen.status).toBe("sent");
        expect(frozen.frozen).toMatchObject({ at: 50, cvTitle: "Design CV", photo: "" });
        expect(frozen.frozen?.sender).toMatchObject({ name: "Amina Hodzic", email: "work@acme.test" });
        expect(frozen.frozen?.design.accentColor).toBe("#123456");
        expect(frozen.frozen?.tokens).toMatchObject({ name: "Amina Hodzic", role: "Senior Product Designer" });
        expect(frozen.cvId).toBe("cv-1");
    });

    it("keeps the photo only when the letter showed it", () => {
        const cv = makeCv({ photo: "data:image/png;base64,AAAA" });
        expect(freezeLetter(makeLetter(), cv, 1).frozen?.photo).toBe("");
        expect(freezeLetter(makeLetter({ showPhoto: true }), cv, 1).frozen?.photo).toBe("data:image/png;base64,AAAA");
    });

    it("leaves the body, recipient and overrides exactly as they were", () => {
        const letter = makeLetter({ senderOverrides: { phone: "1" }, recipient: { name: "Jane", address: "x" } });
        const frozen = freezeLetter(letter, makeCv(), 9);
        expect(frozen.paragraphs).toEqual(letter.paragraphs);
        expect(frozen.recipient).toEqual(letter.recipient);
        expect(frozen.senderOverrides).toEqual({ phone: "1" });
    });

    it("makes the resolved letter identical whatever happens to the CV afterwards", () => {
        const frozen = freezeLetter(makeLetter(), makeCv(), 9);
        const before = resolveLetter(frozen, makeCv());
        expect(resolveLetter(frozen, makeCv({ name: "Renamed", accent: "#ff0000", phone: "0", headline: "Other" }))).toEqual(before);
        expect(resolveLetter(frozen, null)).toEqual(before);
    });

    it("moves updatedAt forward", () => {
        expect(freezeLetter(makeLetter({ updatedAt: 100 }), makeCv(), 5).updatedAt).toBe(101);
    });
});

describe("unfreezeLetter", () => {
    it("returns a live draft that follows the CV again and drops the frozen copy", () => {
        const frozen = freezeLetter(makeLetter({ senderOverrides: { email: "work@acme.test" } }), makeCv(), 9);
        const draft = unfreezeLetter(frozen, "cv-2", makeCv({ id: "cv-2", name: "Other Person" }), 20);
        expect(draft).toMatchObject({ status: "draft", cvId: "cv-2", frozen: null });
        expect(draft.senderOverrides).toEqual({ email: "work@acme.test" });
        expect(draft.lastResolved?.sender.name).toBe("Other Person");
        expect(resolveLetter(draft, makeCv({ id: "cv-2", name: "Other Person" })).frozen).toBe(false);
    });
});

describe("sendWarnings", () => {
    it("lists missing sender fields, unresolved tokens and a photo that cannot be shown", () => {
        const cv = { ...createEmptyResume(), id: "cv-1" };
        const letter = makeLetter({ showPhoto: true, paragraphs: [{ id: "a", markdown: "{{skills}}", prompt: "" }] });
        const codes = sendWarnings(letter, cv).map((warning) => `${warning.code}:${warning.detail ?? ""}`);
        expect(codes).toContain("missing-sender-field:name");
        expect(codes).toContain("missing-sender-field:email");
        expect(codes).toContain("unresolved-token:skills");
        expect(codes).toContain("photo-unavailable:");
    });

    it("is empty for a complete letter", () => {
        expect(sendWarnings(makeLetter(), makeCv())).toEqual([]);
    });
});
