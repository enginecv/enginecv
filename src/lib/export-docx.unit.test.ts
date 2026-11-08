import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { contrastOnWhite } from "./color-contrast";
import { toDocumentModel, type DocumentModel } from "./document-model";
import { buildDocx, ensureReadableAccent, type DocxStyle } from "./export-docx";
import {
    createQaEdgeCaseResume,
    createQaFullResume,
    createQaMinimalResume,
    QA_HIDDEN_MARKER,
    QA_RESUME_FIXTURES,
} from "./qa/sample-resumes";

const STYLE: DocxStyle = { fontFamily: "Inter", accent: "#b84a24", text: "#111827", paperSize: "a4" };

async function documentXml(model: DocumentModel, style: Partial<DocxStyle> = {}, includePhoto = false) {
    const result = await buildDocx(model, { style: { ...STYLE, ...style }, includePhoto });
    const zip = await JSZip.loadAsync(result.blob);
    const xml = await zip.file("word/document.xml")!.async("string");
    const styles = await zip.file("word/styles.xml")!.async("string");
    const rels = await zip.file("word/_rels/document.xml.rels")!.async("string");
    return { ...result, xml, styles, rels, zip };
}

/** Text content in document order, ignoring run boundaries. */
function textOf(xml: string): string {
    return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((match) => match[1]).join("");
}

function decodeXml(value: string): string {
    return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

describe("ensureReadableAccent", () => {
    it("keeps accents that already read on white", () => {
        expect(ensureReadableAccent("#b84a24")).toBe("#b84a24");
    });

    it("darkens light accents to at least 3:1", () => {
        const darkened = ensureReadableAccent("#ffaa8d");
        expect(darkened).not.toBe("#ffaa8d");
        expect(contrastOnWhite(darkened)).toBeGreaterThanOrEqual(3);
    });

    it("normalizes short hex and falls back on invalid input", () => {
        expect(ensureReadableAccent("#036")).toBe("#003366");
        expect(ensureReadableAccent("not-a-colour")).toBe("#111827");
    });
});

describe("buildDocx", () => {
    it("produces a readable package for every fixture without hidden content", async () => {
        for (const fixture of QA_RESUME_FIXTURES) {
            const { xml } = await documentXml(toDocumentModel(fixture.create()));
            expect(xml, fixture.id).toContain("<w:body>");
            expect(textOf(xml), fixture.id).not.toContain(QA_HIDDEN_MARKER);
        }
    });

    it("keeps visible section headings in preview order", async () => {
        const model = toDocumentModel(createQaFullResume());
        const text = decodeXml(textOf((await documentXml(model)).xml));
        let cursor = -1;
        for (const section of model.sections) {
            const index = text.indexOf(section.heading, cursor + 1);
            expect(index, section.heading).toBeGreaterThan(cursor);
            cursor = index;
        }
        expect(text).toContain(model.basics.name);
    });

    it("maps rich text to formatted runs, list numbering and hyperlinks", async () => {
        const { xml, rels } = await documentXml(toDocumentModel(createQaFullResume()));
        expect(xml).toMatch(/<w:b\/>[\s\S]*?<w:t[^>]*>replication<\/w:t>/);
        expect(xml).toMatch(/<w:i\/>[\s\S]*?<w:t[^>]*>quorum<\/w:t>/);
        expect(xml).toContain("<w:numPr>");
        expect(xml).toContain("<w:hyperlink");
        expect(rels).toContain("https://example.com/runbook");
    });

    it("applies the template font, falling back to Calibri", async () => {
        const model = toDocumentModel(createQaMinimalResume());
        expect((await documentXml(model)).styles).toContain('w:ascii="Inter"');
        expect((await documentXml(model, { fontFamily: "" })).styles).toContain('w:ascii="Calibri"');
    });

    it("colours headings with the readable accent", async () => {
        const model = toDocumentModel(createQaFullResume());
        const accent = ensureReadableAccent("#ffaa8d").slice(1);
        const { xml } = await documentXml(model, { accent: "#ffaa8d" });
        expect(xml.toLowerCase()).toContain(`w:val="${accent}"`);
    });

    it("includes the photo only when asked", async () => {
        const model = toDocumentModel(createQaFullResume());
        expect(model.basics.photo).not.toBeNull();

        const without = await documentXml(model, {}, false);
        expect(without.xml).not.toContain("<w:drawing>");

        const withPhoto = await documentXml(model, {}, true);
        expect(withPhoto.xml).toContain("<w:drawing>");
        expect(withPhoto.photoSkipped).toBe(false);
    });

    it("skips an unreadable photo and reports it", async () => {
        const model = toDocumentModel(createQaFullResume());
        model.basics.photo = { ...model.basics.photo!, dataUrl: "data:image/webp;base64,AAAA", mimeType: "image/webp" };
        const result = await documentXml(model, {}, true);
        expect(result.photoSkipped).toBe(true);
        expect(result.xml).not.toContain("<w:drawing>");
    });

    it("renders a nameless resume without an empty title", async () => {
        const { xml } = await documentXml(toDocumentModel(createQaEdgeCaseResume()));
        expect(xml).not.toContain('w:val="Title"');
    });

    it("uses Letter page size when requested", async () => {
        const { xml } = await documentXml(toDocumentModel(createQaMinimalResume()), { paperSize: "letter" });
        expect(xml).toContain('w:w="12240"');
    });
});
