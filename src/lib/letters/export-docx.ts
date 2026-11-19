import { AlignmentType, BorderStyle, Document, FrameAnchorType, LevelFormat, LineRuleType, Packer, Paragraph, TextRun } from "docx";
import { ensureReadableAccent, normalizeHex } from "@/lib/color-contrast";
import type { DocumentImage } from "@/lib/document-model";
import {
    BULLETS,
    FALLBACK_FONT,
    NUMBERS,
    PAGE,
    hex,
    markdownParagraphs,
    photoParagraph,
    type BuildContext,
    type DocxExportResult,
} from "@/lib/export-docx";
import { DIN5008_A4, dinBlocks } from "./din5008";
import type { ResolvedLetter } from "./resolve";

/**
 * The letter as a Word file: the CV's font and accent, the letter's paper size, real
 * paragraphs, lists and hyperlinks, and the photo only when the person opts in (as for the
 * CV's Word export). Only ever reached through a dynamic import, so `docx` stays out of
 * the editor bundle.
 */

export interface LetterDocxOptions {
    includePhoto: boolean;
}

const TWIPS_PER_MM = 56.6929;
const AFTER = 160;

function lines(text: string): string[] {
    return text.split("\n").map((line) => line.trim()).filter(Boolean);
}

/** The photo as the Word exporter's image type, or null when it is not a usable data URL. */
function toImage(dataUrl: string, alt: string): DocumentImage | null {
    const match = /^data:([^;,]+)[;,]/.exec(dataUrl.trim());
    return match ? { dataUrl: dataUrl.trim(), mimeType: match[1], width: 96, height: 120, alt } : null;
}

export async function buildLetterDocx(letter: ResolvedLetter, options: LetterDocxOptions): Promise<DocxExportResult> {
    const { design, sender } = letter;
    const page = PAGE[letter.paperSize];
    const german = letter.layout === "din5008";
    const mmTw = (value: number) => Math.round(value * TWIPS_PER_MM);
    // The German layout has its own margins; the standard one follows the CV's.
    const margin = german
        ? { left: mmTw(DIN5008_A4.marginLeft), right: mmTw(DIN5008_A4.marginRight), top: mmTw(DIN5008_A4.marginTopLater), bottom: mmTw(DIN5008_A4.marginBottom) }
        : { left: mmTw(design.marginHmm), right: mmTw(design.marginHmm), top: mmTw(design.marginVmm), bottom: mmTw(design.marginVmm) };
    const accent = hex(ensureReadableAccent(design.accentColor));
    const context: BuildContext = { accent, contentWidth: page.width - margin.left - margin.right, nextListInstance: 1 };
    const size = Math.max(16, Math.round(design.fontSize * 2));

    const children: Paragraph[] = [];
    const text = (value: string, extra: { bold?: boolean; size?: number; color?: string } = {}) => new TextRun({ text: value, ...extra });
    const plain = (value: string, after = 0, extra: { keepNext?: boolean } = {}) =>
        new Paragraph({ children: [text(value)], spacing: { after }, ...extra });

    let photoSkipped = false;

    /** An absolutely positioned block on page 1: the letterhead, the address field and the date. */
    const framed = (value: string, box: { x: number; y: number; width: number; height: number }, extra: { bold?: boolean; size?: number; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
        new Paragraph({
            children: [text(value, { bold: extra.bold, size: extra.size, color: extra.color })],
            alignment: extra.align,
            spacing: { after: 0 },
            frame: { type: "absolute", position: { x: mmTw(box.x), y: mmTw(box.y) }, width: mmTw(box.width), height: mmTw(box.height), anchor: { horizontal: FrameAnchorType.PAGE, vertical: FrameAnchorType.PAGE } },
        });

    /** DIN 5008 page one: letterhead, return line and recipient in the address field, date, then a gap down to the text. */
    const germanLeading = (): Paragraph[] => {
        const { letterhead, addressField, infoBlock, marginLeft, marginRight, bodyTop, marginTopLater, page: a4 } = DIN5008_A4;
        const blocks = dinBlocks({ senderName: sender.name, senderAddress: sender.address, recipientName: letter.recipient.name, recipientAddress: letter.recipient.address });
        const head = { x: marginLeft, y: letterhead.top, width: a4.width - marginLeft - marginRight, height: letterhead.height };
        const field = { x: addressField.left, y: addressField.top, width: addressField.width, height: addressField.height };
        const contactLine = [sender.email, sender.phone, sender.website].filter(Boolean).join("  ·  ");
        const out: Paragraph[] = [];
        if (sender.name) out.push(framed(sender.name, head, { bold: true, size: Math.round(size * 1.9), color: accent }));
        if (sender.headline) out.push(framed(sender.headline, head));
        if (contactLine) out.push(framed(contactLine, head));
        for (const line of lines(sender.address)) out.push(framed(line, head));
        if (blocks.returnLine) out.push(framed(blocks.returnLine, field, { size: 14 }));
        for (const line of blocks.recipient) out.push(framed(line, field));
        out.push(framed(letter.date, { x: infoBlock.left, y: infoBlock.top, width: infoBlock.width, height: 8 }, { align: AlignmentType.RIGHT }));
        // The text starts further down page one than the margin: an empty line of exactly that height.
        out.push(new Paragraph({ children: [], spacing: { before: 0, after: 0, line: mmTw(bodyTop - marginTopLater), lineRule: LineRuleType.EXACT } }));
        return out;
    };
    if (options.includePhoto && letter.photo && german) {
        // The German layout's letterhead is fixed text; there is no place for the photo in the Word file.
        photoSkipped = true;
    } else if (options.includePhoto && letter.photo) {
        const image = toImage(letter.photo, sender.name);
        try {
            if (!image) throw new Error("Not an image");
            children.push(await photoParagraph(image));
        } catch {
            photoSkipped = true;
        }
    }

    if (german) {
        children.push(...germanLeading());
    } else {
        // Sender block, ruled in the accent colour like the on-screen header.
        const contact = [sender.email, sender.phone, sender.website].filter(Boolean).join("  ·  ");
        const headerRows: { children: TextRun[]; after: number; title?: boolean }[] = [];
        if (sender.name) headerRows.push({ children: [text(sender.name, { bold: true, size: Math.round(size * 1.9), color: accent })], after: 40, title: true });
        if (sender.headline) headerRows.push({ children: [text(sender.headline)], after: 40 });
        if (contact) headerRows.push({ children: [text(contact)], after: 40 });
        for (const line of lines(sender.address)) headerRows.push({ children: [text(line)], after: 0 });
        headerRows.forEach((row, index) => {
            const last = index === headerRows.length - 1;
            children.push(new Paragraph({
                children: row.children,
                heading: row.title ? "Title" : undefined,
                spacing: { after: last ? 240 : row.after },
                border: last ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: accent, space: 4 } } : undefined,
            }));
        });
        children.push(plain("", 120));

        children.push(new Paragraph({ children: [text(letter.date)], alignment: AlignmentType.RIGHT, spacing: { after: AFTER } }));
        const recipient = [letter.recipient.name.trim(), ...lines(letter.recipient.address)].filter(Boolean);
        recipient.forEach((line, index) => children.push(plain(line, index === recipient.length - 1 ? AFTER : 0)));
    }
    if (letter.subject.trim()) children.push(new Paragraph({ children: [text(letter.subject, { bold: true })], spacing: { after: AFTER } }));
    if (letter.salutation.trim()) children.push(plain(letter.salutation, AFTER, { keepNext: true }));

    const filled = letter.paragraphs.filter((paragraph) => !paragraph.empty);
    filled.forEach((paragraph, index) => {
        // The last paragraph stays with the closing and signature.
        children.push(...markdownParagraphs(paragraph.markdown, context, { keepWithNext: index === filled.length - 1 && Boolean(letter.closing.trim()) }));
    });
    if (letter.closing.trim()) children.push(plain(letter.closing, 720, { keepNext: true }));
    children.push(plain(sender.signatureName || sender.name, 0));

    const document = new Document({
        title: [letter.subject, sender.name].find((value) => value.trim()) || undefined,
        creator: "EngineCV",
        styles: {
            default: {
                document: { run: { font: design.fontFamily.trim() || FALLBACK_FONT, size, color: hex(normalizeHex(design.textColor) ?? "#111827") } },
            },
        },
        numbering: {
            config: [
                { reference: BULLETS, levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] },
                { reference: NUMBERS, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 300 } } } }] },
            ],
        },
        sections: [{
            properties: { page: { size: page, margin: margin } },
            children,
        }],
    });

    return { blob: await Packer.toBlob(document), photoSkipped };
}
