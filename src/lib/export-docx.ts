import {
    AlignmentType,
    BorderStyle,
    Document,
    ExternalHyperlink,
    ImageRun,
    LevelFormat,
    Packer,
    Paragraph,
    Tab,
    TabStopType,
    TextRun,
    type ParagraphChild,
} from "docx";
import { ensureReadableAccent, normalizeHex } from "./color-contrast";
import {
    toDocumentLink,
    type DocumentDetail,
    type DocumentEntry,
    type DocumentImage,
    type DocumentLink,
    type DocumentModel,
    type DocumentSection,
} from "./document-model";
import { parseMarkdownBlocks, type InlineToken } from "./markdown-inline";

/**
 * DOCX serializer over the document model.
 *
 * Deliberately a single-column, ATS-friendly document rather than a replica of
 * the visual template: real headings, list numbering and hyperlinks, with only
 * the template's font and accent colour carried over. Only ever reached through
 * a dynamic import, so the `docx` library stays out of the editor bundle.
 */

export { ensureReadableAccent } from "./color-contrast";

export interface DocxStyle {
    fontFamily: string;
    accent: string;
    text: string;
    paperSize: "a4" | "letter";
}

export interface DocxExportOptions {
    style: DocxStyle;
    includePhoto: boolean;
}

export interface DocxExportResult {
    blob: Blob;
    photoSkipped: boolean;
}

const FALLBACK_FONT = "Calibri";
const BODY_SIZE = 21; // half-points → 10.5 pt
const MARGIN = 1134; // twips → 2 cm
const PAGE = {
    a4: { width: 11906, height: 16838 },
    letter: { width: 12240, height: 15840 },
} as const;
const BULLETS = "enginecv-bullets";
const NUMBERS = "enginecv-numbers";
const PHOTO_MAX_PX = 120;

type RunFormat = { bold?: boolean; italics?: boolean; code?: boolean };

interface BuildContext {
    accent: string;
    contentWidth: number;
    /** Each ordered list restarts at 1, which needs its own numbering instance. */
    nextListInstance: number;
}

function hex(value: string): string {
    return value.replace(/^#/, "");
}

function run(text: string, format: RunFormat = {}): TextRun {
    return new TextRun({
        text,
        bold: format.bold,
        italics: format.italics,
        font: format.code ? "Consolas" : undefined,
    });
}

function hyperlink(label: string, url: string, format: RunFormat = {}): ExternalHyperlink {
    return new ExternalHyperlink({
        link: url,
        children: [new TextRun({ text: label, style: "Hyperlink", bold: format.bold, italics: format.italics })],
    });
}

function inlineChildren(tokens: InlineToken[], format: RunFormat = {}): ParagraphChild[] {
    return tokens.flatMap((token): ParagraphChild[] => {
        switch (token.type) {
            case "text":
                return [run(token.value, format)];
            case "code":
                return [run(token.value, { ...format, code: true })];
            case "strong":
                return inlineChildren(token.children, { ...format, bold: true });
            case "em":
                return inlineChildren(token.children, { ...format, italics: true });
            case "link": {
                const children = inlineChildren(token.children, format);
                const label = tokenText(token.children);
                // Only targets the document model would accept become clickable.
                const safe = toDocumentLink(token.url, label);
                return safe ? [hyperlink(label || safe.url, safe.url, format)] : children;
            }
        }
    });
}

function tokenText(tokens: InlineToken[]): string {
    return tokens
        .map((token) => (token.type === "text" || token.type === "code" ? token.value : tokenText(token.children)))
        .join("");
}

function markdownParagraphs(markdown: string, context: BuildContext): Paragraph[] {
    return parseMarkdownBlocks(markdown).flatMap((block) => {
        if (block.type === "paragraph") {
            return [new Paragraph({ children: inlineChildren(block.content), spacing: { after: 80 } })];
        }
        const instance = block.ordered ? context.nextListInstance++ : undefined;
        return block.items.map((item) => new Paragraph({
            children: inlineChildren(item),
            numbering: block.ordered
                ? { reference: NUMBERS, level: 0, instance }
                : { reference: BULLETS, level: 0 },
            spacing: { after: 40 },
        }));
    });
}

function linkChild(target: DocumentLink): ParagraphChild {
    return hyperlink(target.label, target.url);
}

function detailChildren(value: DocumentDetail): ParagraphChild[] {
    const text: ParagraphChild = value.url ? hyperlink(value.value, value.url) : run(value.value);
    return value.label ? [run(`${value.label}: `, { bold: true }), text] : [text];
}

/** Interleaves paragraph children with a ` · ` separator run. */
function joined(groups: ParagraphChild[][]): ParagraphChild[] {
    return groups.flatMap((group, index) => (index === 0 ? group : [run(" · "), ...group]));
}

function sectionHeading(text: string, context: BuildContext): Paragraph {
    return new Paragraph({
        children: [new TextRun({ text, bold: true, color: context.accent, size: 26 })],
        heading: "Heading1",
        keepNext: true,
        spacing: { before: 240, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: context.accent, space: 2 } },
    });
}

function tagParagraph(tags: string[], label?: string): Paragraph {
    return new Paragraph({
        children: [
            ...(label ? [run(`${label}: `, { bold: true })] : []),
            run(tags.join(", ")),
        ],
        spacing: { after: 60 },
    });
}

function buildEntry(entry: DocumentEntry, context: BuildContext): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const title = entry.title.trim();
    const subtitle = entry.subtitle.trim();
    const dateRange = entry.dateRange.trim();

    // Title line: bold title, right-aligned date on the same line.
    const titleChildren: ParagraphChild[] = [];
    if (title) {
        titleChildren.push(!subtitle && entry.link
            ? hyperlink(title, entry.link.url, { bold: true })
            : run(title, { bold: true }));
    }
    if (dateRange) titleChildren.push(new TextRun({ children: [new Tab(), dateRange] }));
    if (titleChildren.length > 0) {
        paragraphs.push(new Paragraph({
            children: titleChildren,
            keepNext: true,
            tabStops: [{ type: TabStopType.RIGHT, position: context.contentWidth }],
            spacing: { before: 120 },
        }));
    }

    const metaChildren: ParagraphChild[][] = [];
    if (subtitle) metaChildren.push([entry.link ? hyperlink(subtitle, entry.link.url, { italics: true }) : run(subtitle, { italics: true })]);
    if (entry.location.trim()) metaChildren.push([run(entry.location.trim(), { italics: true })]);
    if (metaChildren.length > 0) {
        paragraphs.push(new Paragraph({ children: joined(metaChildren), keepNext: true, spacing: { after: 60 } }));
    }

    if (entry.body.trim()) paragraphs.push(...markdownParagraphs(entry.body, context));
    for (const bullet of entry.bullets) {
        paragraphs.push(new Paragraph({ children: [run(bullet)], numbering: { reference: BULLETS, level: 0 }, spacing: { after: 40 } }));
    }
    for (const detail of entry.details) {
        paragraphs.push(new Paragraph({ children: detailChildren(detail), spacing: { after: 40 } }));
    }
    if (entry.tags.length > 0) paragraphs.push(tagParagraph(entry.tags));

    return paragraphs;
}

function buildSection(section: DocumentSection, context: BuildContext): Paragraph[] {
    const body: Paragraph[] = [];

    if (section.text.trim()) body.push(...markdownParagraphs(section.text, context));
    if (section.tags.length > 0) body.push(tagParagraph(section.tags));
    for (const group of section.skillGroups) {
        if (group.skills.length > 0) body.push(tagParagraph(group.skills, group.name || undefined));
    }
    for (const entry of section.entries) body.push(...buildEntry(entry, context));

    // A section that resolved to nothing renders no heading either.
    if (body.length === 0) return [];
    return [sectionHeading(section.heading, context), ...body];
}

const DIRECT_IMAGE_TYPES: Record<string, "png" | "jpg" | "gif" | "bmp"> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/bmp": "bmp",
};

function decodeBase64DataUrl(dataUrl: string): Uint8Array {
    const match = /^data:[^;,]+;base64,(.+)$/.exec(dataUrl);
    if (!match) throw new Error("Unsupported image data URL");
    const binary = atob(match[1]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return bytes;
}

/** Formats Word can't embed (WebP, AVIF) are re-encoded to PNG through a canvas. */
async function rasterizeToPng(dataUrl: string): Promise<Uint8Array> {
    if (typeof document === "undefined" || typeof Image === "undefined") throw new Error("No canvas available");
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No 2D context");
    context.drawImage(image, 0, 0);
    return decodeBase64DataUrl(canvas.toDataURL("image/png"));
}

async function photoParagraph(photo: DocumentImage): Promise<Paragraph> {
    const directType = DIRECT_IMAGE_TYPES[photo.mimeType.toLowerCase()];
    const data = directType ? decodeBase64DataUrl(photo.dataUrl) : await rasterizeToPng(photo.dataUrl);
    if (data.length === 0) throw new Error("Empty image");

    const scale = Math.min(1, PHOTO_MAX_PX / Math.max(photo.width || PHOTO_MAX_PX, photo.height || PHOTO_MAX_PX));
    return new Paragraph({
        children: [new ImageRun({
            type: directType ?? "png",
            data,
            transformation: {
                width: Math.round((photo.width || PHOTO_MAX_PX) * scale),
                height: Math.round((photo.height || PHOTO_MAX_PX) * scale),
            },
            altText: { name: photo.alt, title: photo.alt, description: photo.alt },
        })],
        spacing: { after: 120 },
    });
}

function buildHeader(model: DocumentModel, context: BuildContext): Paragraph[] {
    const { basics } = model;
    const paragraphs: Paragraph[] = [];

    if (basics.name) {
        paragraphs.push(new Paragraph({
            children: [new TextRun({ text: basics.name, bold: true, size: 40, color: context.accent })],
            heading: "Title",
            spacing: { after: 60 },
        }));
    }
    if (basics.headline) {
        paragraphs.push(new Paragraph({ children: [new TextRun({ text: basics.headline, size: 24 })], spacing: { after: 80 } }));
    }

    const contact: ParagraphChild[][] = [
        ...basics.emails.map(detailChildren),
        ...(basics.phone ? [[run(basics.phone)]] : []),
        ...(basics.location ? [[run(basics.location)]] : []),
    ];
    if (contact.length > 0) paragraphs.push(new Paragraph({ children: joined(contact) }));
    if (basics.links.length > 0) {
        paragraphs.push(new Paragraph({ children: joined(basics.links.map((target) => [linkChild(target)])) }));
    }
    if (basics.details.length > 0) {
        paragraphs.push(new Paragraph({ children: joined(basics.details.map(detailChildren)) }));
    }

    if (basics.summary.trim()) {
        paragraphs.push(sectionHeading(basics.summaryHeading, context));
        paragraphs.push(...markdownParagraphs(basics.summary, context));
    }
    return paragraphs;
}

export async function buildDocx(model: DocumentModel, options: DocxExportOptions): Promise<DocxExportResult> {
    const { style, includePhoto } = options;
    const page = PAGE[style.paperSize];
    const context: BuildContext = {
        accent: hex(ensureReadableAccent(style.accent)),
        contentWidth: page.width - MARGIN * 2,
        nextListInstance: 1,
    };

    let photoSkipped = false;
    const children: Paragraph[] = [];
    if (includePhoto && model.basics.photo) {
        try {
            children.push(await photoParagraph(model.basics.photo));
        } catch {
            photoSkipped = true;
        }
    }
    children.push(...buildHeader(model, context));
    children.push(...model.sections.flatMap((section) => buildSection(section, context)));

    const document = new Document({
        title: model.basics.name || undefined,
        creator: "EngineCV",
        styles: {
            default: {
                document: {
                    run: {
                        font: style.fontFamily.trim() || FALLBACK_FONT,
                        size: BODY_SIZE,
                        color: hex(normalizeHex(style.text) ?? "#111827"),
                    },
                },
            },
        },
        numbering: {
            config: [
                {
                    reference: BULLETS,
                    levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 240 } } } }],
                },
                {
                    reference: NUMBERS,
                    levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 300 } } } }],
                },
            ],
        },
        sections: [{
            properties: {
                page: {
                    size: page,
                    margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
                },
            },
            children,
        }],
    });

    return { blob: await Packer.toBlob(document), photoSkipped };
}
