import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { makeCv, makeLetter } from "../../../test/setup/letter-fixtures";
import { buildLetterDocx } from "./export-docx";
import { resolveLetter } from "./resolve";

const PHOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function build(overrides = {}, cv = makeCv(), includePhoto = false) {
    const result = await buildLetterDocx(resolveLetter(makeLetter(overrides), cv), { includePhoto });
    const zip = await JSZip.loadAsync(result.blob);
    const xml = await zip.file("word/document.xml")!.async("string");
    const rels = await zip.file("word/_rels/document.xml.rels")!.async("string");
    return { ...result, xml, rels, zip };
}

const textOf = (xml: string) => [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((match) => match[1]).join("|");

describe("buildLetterDocx", () => {
    it("contains the letter's content in reading order", async () => {
        const { xml } = await build({ subject: "Application as Designer", recipient: { name: "Jane Roe", address: "1 Main St" }, paragraphs: [{ id: "a", markdown: "First.", prompt: "" }, { id: "b", markdown: "Second.", prompt: "" }] });
        const text = textOf(xml);
        const order = ["Amina Hodzic", "amina@example.com", "November 18, 2026", "Jane Roe", "Application as Designer", "Dear Hiring Team,", "First.", "Second.", "Kind regards,"];
        const positions = order.map((part) => text.indexOf(part));
        expect(positions.every((position) => position >= 0)).toBe(true);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });

    it("keeps bold, italic, links and lists", async () => {
        const { xml, rels } = await build({ paragraphs: [{ id: "a", markdown: "I am **bold** and *slanted*.\n\n- one\n- two\n\nSee [my site](https://example.com).", prompt: "" }] });
        expect(xml).toMatch(/<w:b\/>[\s\S]*bold/);
        expect(xml).toMatch(/<w:i\/>[\s\S]*slanted/);
        expect(xml).toContain("<w:numPr>");
        expect(xml).toContain("<w:hyperlink");
        expect(rels).toContain("https://example.com");
    });

    it("never contains token syntax", async () => {
        const { xml } = await build({ subject: "{{role}}", paragraphs: [{ id: "a", markdown: "{{name}} {{nothing}}", prompt: "" }] });
        expect(textOf(xml)).not.toContain("{{");
        expect(textOf(xml)).toContain("Senior Product Designer");
    });

    it("uses the CV's font, the letter's paper size and margins", async () => {
        const cv = makeCv({ fontFamily: "Lora" });
        cv.settings.spacing.marginH = 25;
        const { xml, zip } = await build({ paperSize: "letter" }, cv);
        const styles = await zip.file("word/styles.xml")!.async("string");
        expect(styles).toContain("Lora");
        expect(xml).toMatch(/<w:pgSz[^>]*w:w="12240"/);
        expect(xml).toMatch(/<w:pgMar[^>]*w:left="1417"/);
    });

    it("includes the photo only when the letter shows it and the person opts in", async () => {
        const cv = makeCv({ photo: PHOTO });
        expect((await build({ showPhoto: true }, cv, false)).xml).not.toContain("<w:drawing");
        const withPhoto = await build({ showPhoto: true }, cv, true);
        expect(withPhoto.xml).toContain("<w:drawing");
        expect(withPhoto.photoSkipped).toBe(false);
        expect((await build({ showPhoto: false }, cv, true)).xml).not.toContain("<w:drawing");
    });

    it("reports a photo it could not include instead of failing", async () => {
        const broken = await build({ showPhoto: true }, makeCv({ photo: "not-a-data-url" }), true);
        expect(broken.photoSkipped).toBe(true);
        expect(textOf(broken.xml)).toContain("Amina Hodzic");
    });

    it("keeps the last paragraph, the closing and the signature together", async () => {
        const { xml } = await build({ paragraphs: [{ id: "a", markdown: "Only paragraph.", prompt: "" }] });
        const closingParagraph = xml.split("<w:p>").find((paragraph) => paragraph.includes("Kind regards,")) ?? "";
        expect(closingParagraph).toContain("<w:keepNext/>");
    });
});

describe("buildLetterDocx: German layout", () => {
    const TWIPS_PER_MM = 56.6929;
    const german = (overrides = {}, cv = makeCv({ language: "de" })) => build({ layout: "din5008", paperSize: "a4", recipient: { name: "Frau Roe", address: "Acme GmbH\nMusterweg 2\n20095 Hamburg" }, ...overrides }, cv);

    it("sets the standard's margins: 25 mm left, 20 mm right", async () => {
        const { xml } = await german();
        expect(xml).toMatch(new RegExp(`<w:pgMar[^>]*w:left="${Math.round(25 * TWIPS_PER_MM)}"`));
        expect(xml).toMatch(new RegExp(`<w:pgMar[^>]*w:right="${Math.round(20 * TWIPS_PER_MM)}"`));
    });

    it("positions the address field 20 mm from the left and 45 mm from the top, 85 mm wide", async () => {
        const { xml } = await german();
        const frames = [...xml.matchAll(/<w:framePr[^>]*>/g)].map((match) => match[0]);
        const address = frames.filter((frame) => frame.includes(`w:y="${Math.round(45 * TWIPS_PER_MM)}"`) && frame.includes(`w:x="${Math.round(20 * TWIPS_PER_MM)}"`));
        expect(address.length).toBeGreaterThan(0);
        expect(address[0]).toContain(`w:w="${Math.round(85 * TWIPS_PER_MM)}"`);
    });

    it("puts the date in the information block at 125 mm", async () => {
        const { xml } = await german();
        expect(xml).toContain(`w:x="${Math.round(125 * TWIPS_PER_MM)}"`);
    });

    it("keeps the same content, in order: recipient, then the text", async () => {
        const { xml } = await german({ subject: "Bewerbung als Designerin" });
        const text = textOf(xml);
        expect(text.indexOf("Frau Roe")).toBeGreaterThan(-1);
        expect(text.indexOf("Frau Roe")).toBeLessThan(text.indexOf("Bewerbung als Designerin"));
        expect(text.indexOf("Bewerbung als Designerin")).toBeLessThan(text.indexOf("Dear Hiring Team,"));
    });

    it("says the photo could not be included, since the letterhead is fixed text", async () => {
        const result = await german({ showPhoto: true }, makeCv({ language: "de", photo: PHOTO }));
        const withOptIn = await buildLetterDocx(resolveLetter(makeLetter({ layout: "din5008", showPhoto: true }), makeCv({ language: "de", photo: PHOTO })), { includePhoto: true });
        expect(withOptIn.photoSkipped).toBe(true);
        expect(result.xml).not.toContain("<w:drawing");
    });

    it("leaves the standard layout without frames", async () => {
        expect((await build()).xml).not.toContain("<w:framePr");
    });
});
