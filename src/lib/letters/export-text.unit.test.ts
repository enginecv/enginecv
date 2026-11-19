import { describe, expect, it } from "vitest";
import { makeCv, makeLetter } from "../../../test/setup/letter-fixtures";
import { toLetterPlainText } from "./export-text";
import { resolveLetter } from "./resolve";

const text = (overrides = {}, cv = makeCv()) => toLetterPlainText(resolveLetter(makeLetter(overrides), cv));

describe("toLetterPlainText", () => {
    it("lists sender, date, recipient, subject, salutation, paragraphs, closing and signature in reading order", () => {
        const out = text({
            subject: "Application as Designer",
            recipient: { name: "Jane Roe", address: "1 Main St\n10115 Berlin" },
            paragraphs: [{ id: "a", markdown: "First paragraph.", prompt: "" }, { id: "b", markdown: "Second paragraph.", prompt: "" }],
        });
        const order = ["Amina Hodzic", "Senior Product Designer", "amina@example.com", "November 18, 2026", "Jane Roe", "10115 Berlin", "Application as Designer", "Dear Hiring Team,", "First paragraph.", "Second paragraph.", "Kind regards,"];
        const positions = order.map((part) => out.indexOf(part));
        expect(positions.every((position) => position >= 0)).toBe(true);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
        expect(out.trimEnd().endsWith("Amina Hodzic")).toBe(true); // the signature
    });

    it("drops styling, turns list items into dashes and shows a link's address after its text", () => {
        const out = text({ paragraphs: [{ id: "a", markdown: "I am **very** *keen*.\n\n- one\n- two\n\nSee [my site](https://example.com).", prompt: "" }] });
        expect(out).toContain("I am very keen.");
        expect(out).toContain("- one\n- two");
        expect(out).toContain("my site (https://example.com)");
        expect(out).not.toContain("**");
        expect(out).not.toContain("*keen*");
    });

    it("never contains token syntax, and prints nothing for a token with no value", () => {
        const out = text({ subject: "{{role}}", paragraphs: [{ id: "a", markdown: "From {{location}} with {{nothing}}.", prompt: "" }] }, makeCv({ location: "" }));
        expect(out).not.toContain("{{");
        expect(out).toContain("Senior Product Designer");
        expect(out).toContain("From  with .");
    });

    it("skips empty paragraphs and the hints that go with them", () => {
        const out = text({ paragraphs: [{ id: "a", markdown: "", prompt: "A hint that must not print" }, { id: "b", markdown: "Real text.", prompt: "" }] });
        expect(out).not.toContain("hint");
        expect(out).toContain("Real text.");
    });

    it("uses the signature override", () => {
        const out = text({ senderOverrides: { signatureName: "A. H." } });
        expect(out.trimEnd().endsWith("A. H.")).toBe(true);
    });
});
