import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { toDocumentModel } from "@/lib/document-model";
import { buildDocx, type DocxStyle } from "@/lib/export-docx";
import { checkExtractedText, expectedFieldsInOrder } from "@/lib/qa/parse-check";
import { QA_RESUME_FIXTURES } from "@/lib/qa/sample-resumes";

/**
 * Parse-ability of the DOCX export (FR-029): whatever a parser pulls out of the
 * file has to contain every visible field, in reading order, and nothing hidden.
 *
 * Extraction mirrors what a naive parser does — concatenate the text runs of
 * each paragraph, one paragraph per line — rather than reading our own model back.
 */

const STYLE: DocxStyle = { fontFamily: "Inter", accent: "#a24120", text: "#111827", paperSize: "a4" };
const NEWLINE = String.fromCharCode(10);

function decodeXml(value: string): string {
    return value
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&");
}

/** Maps relationship ids to their targets, so hyperlink URLs can be resolved. */
function relationshipTargets(relsXml: string): Map<string, string> {
    return new Map([...relsXml.matchAll(/<Relationship\b([^>]*)\/>/g)].flatMap(([, attributes]) => {
        const id = /Id="([^"]+)"/.exec(attributes)?.[1];
        const target = /Target="([^"]+)"/.exec(attributes)?.[1];
        return id && target ? [[id, decodeXml(target)] as [string, string]] : [];
    }));
}

function runsText(fragment: string): string {
    return [...fragment.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)]
        .map(([, text]) => decodeXml(text))
        .join("");
}

/**
 * One paragraph as a parser sees it. Hyperlinks carry their URL in the
 * relationship part rather than inline, so the target is resolved and appended
 * the way the plain-text export writes it.
 */
function paragraphText(paragraph: string, targets: Map<string, string>): string {
    let text = "";
    let cursor = 0;
    for (const match of paragraph.matchAll(/<w:hyperlink\b([^>]*)>([\s\S]*?)<\/w:hyperlink>/g)) {
        const index = match.index ?? 0;
        text += runsText(paragraph.slice(cursor, index));
        const target = targets.get(/r:id="([^"]+)"/.exec(match[1])?.[1] ?? "");
        const label = runsText(match[2]);
        text += target ? label + " (" + target + ")" : label;
        cursor = index + match[0].length;
    }
    return text + runsText(paragraph.slice(cursor));
}

/** Text of every `w:p` in document order, one paragraph per line. */
function extractParagraphText(xml: string, targets: Map<string, string>): string {
    const body = xml.slice(xml.indexOf("<w:body>"), xml.indexOf("</w:body>"));
    return [...body.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)]
        .map(([, paragraph]) => paragraphText(paragraph, targets))
        .join(NEWLINE);
}

async function extractDocxText(resume: ReturnType<typeof QA_RESUME_FIXTURES[number]["create"]>) {
    const { blob } = await buildDocx(toDocumentModel(resume), { style: STYLE, includePhoto: false });
    const zip = await JSZip.loadAsync(blob);
    const targets = relationshipTargets(await zip.file("word/_rels/document.xml.rels")!.async("string"));
    return extractParagraphText(await zip.file("word/document.xml")!.async("string"), targets);
}

describe("DOCX text extraction", () => {
    it.each(QA_RESUME_FIXTURES.map((fixture) => [fixture.id, fixture.create] as const))(
        "extracts every visible field of %s in order",
        async (_id, create) => {
            const resume = create();
            const extracted = await extractDocxText(resume);

            expect(checkExtractedText(extracted, expectedFieldsInOrder(resume))).toEqual({
                missingFields: [],
                orderErrors: [],
                leakedFields: [],
                pass: true,
            });
        },
    );

    it("keeps hyperlink labels as extractable text", async () => {
        const extracted = await extractDocxText(QA_RESUME_FIXTURES[0].create());
        expect(extracted).toContain("@");
    });
});
