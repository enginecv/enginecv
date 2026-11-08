import { describe, expect, it } from "vitest";
import { toDocumentModel } from "./document-model";
import { markdownToPlainText, toPlainText } from "./export-plaintext";
import {
    createQaEdgeCaseResume,
    createQaFullResume,
    createQaMinimalResume,
    QA_HIDDEN_MARKER,
    QA_RESUME_FIXTURES,
} from "./qa/sample-resumes";

describe("markdownToPlainText", () => {
    it("drops inline markup and keeps link targets visible", () => {
        expect(markdownToPlainText("Led the **replication** rewrite and its [runbook](https://example.com/runbook)."))
            .toBe("Led the replication rewrite and its runbook (https://example.com/runbook).");
    });

    it("keeps list structure with simple bullets and numbers", () => {
        expect(markdownToPlainText("- one\n- *two*\n\n1. first\n2. `second`")).toBe("- one\n- two\n\n1. first\n2. second");
    });

    it("never prints an unsafe link target", () => {
        expect(markdownToPlainText("[click](javascript:void)")).toBe("click");
    });
});

describe("toPlainText", () => {
    it("contains no markup for any fixture", () => {
        for (const fixture of QA_RESUME_FIXTURES) {
            const text = toPlainText(toDocumentModel(fixture.create()));
            expect(text, fixture.id).not.toMatch(/\*\*|__|\]\(|^#+ /m);
            expect(text, fixture.id).not.toContain(QA_HIDDEN_MARKER);
            expect(text.endsWith("\n") && !text.endsWith("\n\n"), fixture.id).toBe(true);
        }
    });

    it("keeps every visible section heading in preview order", () => {
        const model = toDocumentModel(createQaFullResume());
        const text = toPlainText(model);
        let cursor = -1;
        for (const section of model.sections) {
            const index = text.indexOf(`\n${section.heading.toUpperCase()}\n`, cursor + 1);
            expect(index, section.heading).toBeGreaterThan(cursor);
            cursor = index;
        }
    });

    it("preserves non-Latin text", () => {
        const text = toPlainText(toDocumentModel(createQaFullResume()));
        expect(text).toContain("Šehić-Đurić");
    });

    it("renders no empty heading for a sparse resume", () => {
        const model = toDocumentModel(createQaMinimalResume());
        const text = toPlainText(model);
        expect(text).not.toMatch(/\n[^\n]+\n\n[A-Z ]+\n$/);
        expect(text.trim().length).toBeGreaterThan(0);
    });

    it("handles a resume with no name", () => {
        const text = toPlainText(toDocumentModel(createQaEdgeCaseResume()));
        expect(text.startsWith("\n")).toBe(false);
    });
});
