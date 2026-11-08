import { describe, expect, it } from "vitest";
import { toDocumentModel } from "@/lib/document-model";
import { toPlainText } from "@/lib/export-plaintext";
import {
    checkExtractedText,
    expectedFieldsInOrder,
    normalizeExtractedText,
    type ExpectedField,
} from "@/lib/qa/parse-check";
import {
    QA_HIDDEN_MARKER,
    QA_RESUME_FIXTURES,
    createQaFullResume,
    createQaMinimalResume,
} from "@/lib/qa/sample-resumes";

const SOFT_HYPHEN = String.fromCharCode(0xad);
const NEWLINE = String.fromCharCode(10);

function textForSections(expected: ExpectedField[], keys: string[]): string {
    return keys
        .map((key) => expected
            .filter((field) => field.section === key)
            .map((field) => field.text)
            .join(NEWLINE))
        .join(NEWLINE + NEWLINE);
}

describe("normalizeExtractedText", () => {
    it("joins hyphenated line breaks, strips soft hyphens and collapses whitespace", () => {
        const raw = ["Soft", SOFT_HYPHEN, "ware  develop-", NEWLINE, "ment", NEWLINE, "\tteam"].join("");
        expect(normalizeExtractedText(raw)).toBe("software development team");
    });

    it("keeps real hyphens that are not at a line break", () => {
        expect(normalizeExtractedText("Full-Stack Engineer")).toBe("full-stack engineer");
    });

    it("compares case-insensitively because templates uppercase headings", () => {
        expect(normalizeExtractedText("EXPERIENCE")).toBe(normalizeExtractedText("Experience"));
    });
});

describe("checkExtractedText", () => {
    it.each(QA_RESUME_FIXTURES.map((fixture) => [fixture.id, fixture.create] as const))(
        "passes for the plain-text export of %s (positive control)",
        (_id, create) => {
            const resume = create();
            const extracted = toPlainText(toDocumentModel(resume));

            expect(checkExtractedText(extracted, expectedFieldsInOrder(resume))).toEqual({
                missingFields: [],
                orderErrors: [],
                leakedFields: [],
                pass: true,
            });
        },
    );

    it("reports a field that is missing from the extracted text", () => {
        const resume = createQaFullResume();
        const expected = expectedFieldsInOrder(resume);
        const name = expected[0].text;
        const extracted = toPlainText(toDocumentModel(resume)).split(name).join("");

        const result = checkExtractedText(extracted, expected);

        expect(result.pass).toBe(false);
        expect(result.missingFields).toContain(normalizeExtractedText(name));
    });

    it("reports sections that appear out of order", () => {
        const resume = createQaFullResume();
        const expected = expectedFieldsInOrder(resume);
        const sections = [...new Set(expected.map((field) => field.section))];
        const reordered = textForSections(expected, [...sections].reverse());

        const result = checkExtractedText(reordered, expected);

        expect(result.missingFields).toEqual([]);
        expect(result.orderErrors.length).toBeGreaterThan(0);
        expect(result.pass).toBe(false);
    });

    it("accepts a separate flow (e.g. a sidebar) read before the main column when grouped", () => {
        const resume = createQaFullResume();
        const expected = expectedFieldsInOrder(resume);
        const sections = [...new Set(expected.map((field) => field.section))];
        const main = sections.slice(0, 3);
        const sidebar = sections.slice(3);
        const extracted = textForSections(expected, [...sidebar, ...main]);

        expect(checkExtractedText(extracted, expected).orderErrors.length).toBeGreaterThan(0);
        expect(checkExtractedText(extracted, expected, { orderGroups: [main, sidebar] }).orderErrors).toEqual([]);
    });

    it("never expects hidden entries and flags them when they leak", () => {
        const resume = createQaFullResume();
        const expected = expectedFieldsInOrder(resume);
        expect(expected.some((field) => field.text.includes(QA_HIDDEN_MARKER))).toBe(false);

        const leaked = [toPlainText(toDocumentModel(resume)), `${QA_HIDDEN_MARKER} entry`].join(NEWLINE);
        const result = checkExtractedText(leaked, expected);

        expect(result.leakedFields).toEqual([QA_HIDDEN_MARKER]);
        expect(result.pass).toBe(false);
    });

    it("expects only what a minimal resume actually shows", () => {
        const resume = createQaMinimalResume();
        const expected = expectedFieldsInOrder(resume);

        expect(expected.length).toBeGreaterThan(0);
        expect(checkExtractedText("", expected).missingFields.length).toBe(expected.length);
    });
});
