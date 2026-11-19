import type { Resume } from "@/lib/schema";
import { pickLetterDesign } from "./design";
import { missingSenderKeys, resolveSender } from "./sender";
import type { LastResolved, LetterDesign, LetterDocument, LetterLayout, LetterPaperSize, Sender, SenderKey } from "./schema";
import { senderSchema, letterDesignSchema } from "./schema";
import { formatLetterDate } from "./starters";
import { substituteTokens, tokenValues, type TokenValues } from "./tokens";

/**
 * The one place that decides what a letter looks like right now. Preview, PDF,
 * DOCX and plain text all consume `ResolvedLetter`, so the override, freeze and
 * token rules cannot drift between them.
 *
 * - A draft reads sender, design, photo and token values live from its CV.
 * - A sent or snapshot letter reads only its frozen copy and ignores the CV.
 */

export type LetterWarningCode = "missing-sender-field" | "unresolved-token" | "cv-missing" | "photo-unavailable";

export interface LetterWarning {
    code: LetterWarningCode;
    /** The sender field or token name the warning is about. */
    detail?: string;
}

export interface ResolvedParagraph {
    id: string;
    /** Tokens replaced, no markers: what exports use. */
    markdown: string;
    /** Tokens replaced and wrapped in chip markers: what the preview draws. */
    previewMarkdown: string;
    prompt: string;
    empty: boolean;
}

export interface ResolvedLetter {
    id: string;
    status: LetterDocument["status"];
    /** True when the letter reads from its frozen copy. */
    frozen: boolean;
    sender: Sender;
    /** Sender fields set on this letter that differ from the CV's value. */
    overridden: SenderKey[];
    design: LetterDesign;
    /** Data URL to print in the header, or "". */
    photo: string;
    language: string;
    layout: LetterLayout;
    paperSize: LetterPaperSize;
    /** Print the fold and punch marks of the German layout, not only show them on screen. */
    printFoldMarks: boolean;
    recipient: { name: string; address: string };
    company: string;
    role: string;
    dateIso: string;
    /** The date written in the letter's language. */
    date: string;
    subject: string;
    salutation: string;
    closing: string;
    paragraphs: ResolvedParagraph[];
    tokenValues: TokenValues;
    warnings: LetterWarning[];
}

/** What a draft takes from its CV: also what freezing and the last-resolved cache store. */
export interface CvParts {
    sender: Sender;
    overridden: SenderKey[];
    design: LetterDesign;
    photo: string;
    tokens: TokenValues;
    cvTitle: string;
}

export function readCvParts(letter: Pick<LetterDocument, "senderOverrides" | "showPhoto">, cv: Resume): CvParts {
    const { sender, overridden } = resolveSender(cv, letter.senderOverrides);
    return {
        sender,
        overridden,
        design: pickLetterDesign(cv.settings),
        photo: letter.showPhoto ? cv.basics.photo : "",
        tokens: tokenValues(cv),
        cvTitle: cv.meta.title,
    };
}

/** The cache a draft keeps so it can still be shown, frozen or imported without its CV. */
export function buildLastResolved(letter: Pick<LetterDocument, "senderOverrides" | "showPhoto">, cv: Resume, now: number): LastResolved {
    const parts = readCvParts(letter, cv);
    return { sender: parts.sender, design: parts.design, tokens: parts.tokens, photo: parts.photo, cvTitle: parts.cvTitle, at: now };
}

const EMPTY_TOKENS: TokenValues = { name: "", role: "", location: "", skills: "" };

export function resolveLetter(letter: LetterDocument, cv: Resume | null): ResolvedLetter {
    const warnings: LetterWarning[] = [];
    let sender: Sender;
    let design: LetterDesign;
    let photo: string;
    let tokens: TokenValues;
    let overridden: SenderKey[];

    if (letter.status !== "draft" && letter.frozen) {
        sender = letter.frozen.sender;
        design = letter.frozen.design;
        photo = letter.showPhoto ? letter.frozen.photo : "";
        tokens = { ...EMPTY_TOKENS, ...letter.frozen.tokens };
        overridden = (Object.keys(letter.senderOverrides) as SenderKey[]).filter((key) => letter.senderOverrides[key] !== undefined);
    } else if (cv) {
        const parts = readCvParts(letter, cv);
        ({ sender, design, photo, tokens, overridden } = parts);
    } else {
        warnings.push({ code: "cv-missing" });
        sender = letter.lastResolved?.sender ?? senderSchema.parse({});
        design = letter.lastResolved?.design ?? letterDesignSchema.parse({});
        photo = letter.showPhoto ? (letter.lastResolved?.photo ?? "") : "";
        // The values the CV had when this letter last saw it, so the text stays readable.
        tokens = { ...EMPTY_TOKENS, ...(letter.lastResolved?.tokens ?? {}) };
        overridden = (Object.keys(letter.senderOverrides) as SenderKey[]).filter((key) => letter.senderOverrides[key] !== undefined);
    }

    for (const key of missingSenderKeys(sender)) warnings.push({ code: "missing-sender-field", detail: key });
    if (letter.showPhoto && !photo) warnings.push({ code: "photo-unavailable" });

    const unresolvedSeen = new Set<string>();
    const paragraphs: ResolvedParagraph[] = letter.paragraphs.map((paragraph) => {
        const plain = substituteTokens(paragraph.markdown, tokens);
        const chips = substituteTokens(paragraph.markdown, tokens, { chips: true });
        for (const name of plain.unresolved) {
            if (!unresolvedSeen.has(name)) {
                unresolvedSeen.add(name);
                warnings.push({ code: "unresolved-token", detail: name });
            }
        }
        return { id: paragraph.id, markdown: plain.text, previewMarkdown: chips.text, prompt: paragraph.prompt, empty: paragraph.markdown.trim() === "" };
    });

    // Tokens can also sit in the subject, salutation and closing; resolve them there too.
    const resolveLine = (text: string) => substituteTokens(text, tokens).text;

    return {
        id: letter.id,
        status: letter.status,
        frozen: letter.status !== "draft",
        sender,
        overridden,
        design,
        photo,
        language: letter.language,
        layout: letter.layout,
        paperSize: letter.paperSize,
        printFoldMarks: letter.printFoldMarks,
        recipient: letter.recipient,
        company: letter.company,
        role: letter.role,
        dateIso: letter.date,
        date: formatLetterDate(letter.date, letter.language),
        subject: resolveLine(letter.subject),
        salutation: resolveLine(letter.salutation),
        closing: resolveLine(letter.closing),
        paragraphs,
        tokenValues: tokens,
        warnings,
    };
}

