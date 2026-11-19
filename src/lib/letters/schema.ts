import { z } from "zod";
import { createId } from "@/lib/id";
import type { Resume } from "@/lib/schema";

/**
 * A cover letter is its own document, linked to one CV. A draft reads sender
 * details and design from that CV; a sent or snapshot letter carries a frozen
 * copy and ignores the CV. See specs/090-cover-letters/data-model.md.
 *
 * (Not the unused `coverLetterSchema` inside the resume schema: that one is
 * left alone and never migrated.)
 */

export const PAPER_SIZES = ["a4", "letter"] as const;
export type LetterPaperSize = (typeof PAPER_SIZES)[number];

export const LETTER_LAYOUTS = ["standard", "din5008"] as const;
export type LetterLayout = (typeof LETTER_LAYOUTS)[number];

export const LETTER_STATUSES = ["draft", "sent", "snapshot"] as const;
export type LetterStatus = (typeof LETTER_STATUSES)[number];

/** The sender fields a letter can take from its CV or override. */
export const SENDER_KEYS = ["name", "headline", "email", "phone", "address", "website", "signatureName"] as const;
export type SenderKey = (typeof SENDER_KEYS)[number];

export const senderSchema = z.object({
    name: z.string().default(""),
    headline: z.string().default(""),
    email: z.string().default(""),
    phone: z.string().default(""),
    /** Address lines, one per line. */
    address: z.string().default(""),
    website: z.string().default(""),
    /** Printed under the closing; defaults to the name. */
    signatureName: z.string().default(""),
});
export type Sender = z.infer<typeof senderSchema>;

/** Only the fields the person overrode for this letter. */
// Written out field by field: `senderSchema.partial()` would keep each field's "" default, and then
// every field would look overridden.
export const senderOverridesSchema = z.object({
    name: z.string().optional(),
    headline: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    website: z.string().optional(),
    signatureName: z.string().optional(),
});
export type SenderOverrides = z.infer<typeof senderOverridesSchema>;

/** The subset of CV settings the letter renderer reads (see design.ts). */
export const letterDesignSchema = z.object({
    fontFamily: z.string().default("Inter"),
    fontSize: z.number().default(10),
    lineHeight: z.number().default(1.35),
    textColor: z.string().default("#111827"),
    accentColor: z.string().default("#2563eb"),
    headerFontFamily: z.string().default(""),
    headerFontWeight: z.string().default("700"),
    headerFontStyle: z.string().default("normal"),
    headerTextTransform: z.string().default("none"),
    /** Page margins in millimetres, as the CV stores them. */
    marginHmm: z.number().default(20),
    marginVmm: z.number().default(18),
});
export type LetterDesign = z.infer<typeof letterDesignSchema>;

export const DESIGN_KEYS = ["fontFamily", "fontSize", "lineHeight", "textColor", "accentColor", "headerFontFamily", "headerFontWeight", "headerTextTransform", "marginHmm", "marginVmm"] as const;
export type DesignKey = (typeof DESIGN_KEYS)[number];

/** Only the design values the person changed for this letter; the rest come from the CV, or the default design when there is none. */
// Written out field by field for the same reason as the sender overrides: a partial schema would keep every default.
export const designOverridesSchema = z.object({
    fontFamily: z.string().optional(),
    fontSize: z.number().optional(),
    lineHeight: z.number().optional(),
    textColor: z.string().optional(),
    accentColor: z.string().optional(),
    headerFontFamily: z.string().optional(),
    headerFontWeight: z.string().optional(),
    headerTextTransform: z.string().optional(),
    marginHmm: z.number().optional(),
    marginVmm: z.number().optional(),
});
export type DesignOverrides = z.infer<typeof designOverridesSchema>;

export const lastResolvedSchema = z.object({
    sender: senderSchema,
    design: letterDesignSchema,
    /** Token name to its value when last read from the CV. */
    tokens: z.record(z.string(), z.string()).default({}),
    photo: z.string().default(""),
    cvTitle: z.string().default(""),
    at: z.number(),
});
export type LastResolved = z.infer<typeof lastResolvedSchema>;

export const snapshotSchema = z.object({
    at: z.number(),
    sender: senderSchema,
    design: letterDesignSchema,
    /** Token name to the text it had when frozen. */
    tokens: z.record(z.string(), z.string()).default({}),
    /** Data URL when the photo was shown, else empty. */
    photo: z.string().default(""),
    cvTitle: z.string().default(""),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

export const letterParagraphSchema = z.object({
    id: z.string().default(() => createId()),
    markdown: z.string().default(""),
    /** Hint shown while the paragraph is empty; never exported. */
    prompt: z.string().default(""),
});
export type LetterParagraph = z.infer<typeof letterParagraphSchema>;

export const recipientSchema = z.object({
    name: z.string().default(""),
    /** Address lines, one per line. */
    address: z.string().default(""),
});

export const letterDocumentSchema = z
    .object({
        id: z.string().default(() => createId()),
        cvId: z.string().nullable().default(null),
        /** Written without a CV on purpose: the sender and design live on the letter itself. A linked letter is never standalone. */
        standalone: z.boolean().default(false),
        title: z.string().default(""),
        status: z.enum(LETTER_STATUSES).default("draft"),
        language: z.string().default("en"),
        layout: z.enum(LETTER_LAYOUTS).default("standard"),
        paperSize: z.enum(PAPER_SIZES).default("a4"),
        paperSizeBeforeGerman: z.enum(PAPER_SIZES).nullable().default(null),
        showPhoto: z.boolean().default(false),
        /** German layout: also print the fold and punch marks (they always show in the preview). */
        printFoldMarks: z.boolean().default(false),
        recipient: recipientSchema.default({ name: "", address: "" }),
        company: z.string().default(""),
        role: z.string().default(""),
        /** ISO date (yyyy-mm-dd). */
        date: z.string().default(""),
        subject: z.string().default(""),
        salutation: z.string().default(""),
        paragraphs: z.array(letterParagraphSchema).default([]),
        closing: z.string().default(""),
        senderOverrides: senderOverridesSchema.default({}),
        designOverrides: designOverridesSchema.default({}),
        lastResolved: lastResolvedSchema.nullable().default(null),
        frozen: snapshotSchema.nullable().default(null),
        createdAt: z.number().default(() => Date.now()),
        updatedAt: z.number().default(() => Date.now()),
    })
    .superRefine((letter, ctx) => {
        if (letter.status === "draft") {
            if (!letter.cvId && !letter.standalone) ctx.addIssue({ code: "custom", path: ["cvId"], message: "A draft letter needs a linked CV, or to be standalone." });
            if (letter.frozen) ctx.addIssue({ code: "custom", path: ["frozen"], message: "A draft letter cannot be frozen." });
        } else if (!letter.frozen) {
            ctx.addIssue({ code: "custom", path: ["frozen"], message: "A sent or snapshot letter needs its frozen copy." });
        }
        if (letter.standalone && letter.cvId) ctx.addIssue({ code: "custom", path: ["standalone"], message: "A standalone letter has no linked CV." });
        const ids = new Set<string>();
        for (const paragraph of letter.paragraphs) {
            if (ids.has(paragraph.id)) ctx.addIssue({ code: "custom", path: ["paragraphs"], message: "Paragraph ids must be unique." });
            ids.add(paragraph.id);
        }
    });

export type LetterDocument = z.infer<typeof letterDocumentSchema>;

export const paragraphEntrySchema = z.object({
    id: z.string().default(() => createId()),
    name: z.string().default(""),
    markdown: z.string().default(""),
    createdAt: z.number().default(() => Date.now()),
    updatedAt: z.number().default(() => Date.now()),
});
export type ParagraphEntry = z.infer<typeof paragraphEntrySchema>;

/** English with a US region gets US Letter; everything else A4. */
export function defaultPaperSize(language: string): LetterPaperSize {
    return /^en[-_]us$/i.test(language) ? "letter" : "a4";
}

/** Today as an ISO date in local time. */
export function todayIso(now: number = Date.now()): string {
    const date = new Date(now);
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export interface CreateLetterOptions {
    cvId: string;
    language?: string;
    now?: number;
    /** Starter content (salutation, closing, paragraphs) from starters.ts. */
    starter?: Partial<Pick<LetterDocument, "salutation" | "closing" | "subject" | "paragraphs">>;
}

/** A new draft linked to `cv`, with the language defaulting to the CV's. */
export function createLetter(cv: Pick<Resume, "id" | "settings">, options: CreateLetterOptions): LetterDocument {
    const now = options.now ?? Date.now();
    const language = options.language ?? cv.settings?.language ?? "en";
    const layout: LetterLayout = language.toLowerCase().startsWith("de") ? "din5008" : "standard";
    const paperSize = layout === "din5008" ? "a4" : defaultPaperSize(language);
    return letterDocumentSchema.parse({
        cvId: options.cvId,
        language,
        layout,
        paperSize,
        paperSizeBeforeGerman: layout === "din5008" ? defaultPaperSize(language) : null,
        date: todayIso(now),
        createdAt: now,
        updatedAt: now,
        ...(options.starter ?? {}),
    });
}


export interface CreateStandaloneLetterOptions {
    language: string;
    now?: number;
    starter?: CreateLetterOptions["starter"];
}

/** A new draft with no CV: the person types the sender block and picks the design. */
export function createStandaloneLetter(options: CreateStandaloneLetterOptions): LetterDocument {
    const now = options.now ?? Date.now();
    const layout: LetterLayout = options.language.toLowerCase().startsWith("de") ? "din5008" : "standard";
    return letterDocumentSchema.parse({
        cvId: null,
        standalone: true,
        language: options.language,
        layout,
        paperSize: layout === "din5008" ? "a4" : defaultPaperSize(options.language),
        paperSizeBeforeGerman: layout === "din5008" ? defaultPaperSize(options.language) : null,
        date: todayIso(now),
        createdAt: now,
        updatedAt: now,
        ...(options.starter ?? {}),
    });
}
