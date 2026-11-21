import { createId } from "@/lib/id";
import type { LetterFileContent } from "./file-format";
import { letterDocumentSchema, todayIso, type LetterDocument } from "./schema";

/**
 * Puts what a letter file says onto a letter. The file owns the text and the per-letter overrides;
 * the app keeps what a file never carries: the frozen snapshot, caches, timestamps and paragraph
 * ids. A field the file leaves out stays as it is; a field the file has, even empty, replaces it.
 * Pure. Throws if the result breaks the letter's invariants (the caller reports `invalid-field`).
 */
export function applyLetterContent(current: LetterDocument, content: LetterFileContent, now: number = Date.now()): LetterDocument {
    const next: LetterDocument = {
        ...current,
        recipient: { ...current.recipient },
        senderOverrides: { ...current.senderOverrides },
        designOverrides: { ...current.designOverrides },
    };

    if (content.title !== undefined) next.title = content.title;
    if (content.language !== undefined) next.language = content.language;
    if (content.date !== undefined) next.date = content.date;
    if (content.company !== undefined) next.company = content.company;
    if (content.role !== undefined) next.role = content.role;
    if (content.subject !== undefined) next.subject = content.subject;
    if (content.salutation !== undefined) next.salutation = content.salutation;
    if (content.closing !== undefined) next.closing = content.closing;
    if (content.recipient?.name !== undefined) next.recipient.name = content.recipient.name;
    if (content.recipient?.address !== undefined) next.recipient.address = content.recipient.address;

    if (content.paper !== undefined) next.paperSize = content.paper;
    if (content.layout !== undefined) {
        next.layout = content.layout;
        // The German layout is A4 only; remember the size to return to, as the editor does.
        if (content.layout === "din5008" && current.layout !== "din5008") {
            next.paperSizeBeforeGerman = current.paperSize;
            next.paperSize = "a4";
        }
    }
    if (next.layout === "din5008") next.paperSize = "a4";

    if (content.paragraphs !== undefined) {
        next.paragraphs = content.paragraphs.map((markdown, index) => {
            const existing = current.paragraphs[index];
            return existing ? { ...existing, markdown } : { id: createId(), markdown, prompt: "" };
        });
    }
    if (content.sender !== undefined) next.senderOverrides = Object.fromEntries(Object.entries(content.sender).filter(([, value]) => value !== undefined));
    if (content.design !== undefined) next.designOverrides = Object.fromEntries(Object.entries(content.design).filter(([, value]) => value !== undefined));

    // The link: a CV id links the letter; "standalone" with no CV makes it a letter of its own.
    if (content.cv && content.cv.id) {
        next.cvId = content.cv.id;
        next.standalone = false;
    } else if (content.standalone === true) {
        next.cvId = null;
        next.standalone = true;
    }

    next.updatedAt = Math.max(now, current.updatedAt + 1);
    return letterDocumentSchema.parse(next);
}

/** A new draft letter built from a file: used when an unknown letter file appears in the folder. */
export function letterFromContent(content: LetterFileContent, options: { id: string; now?: number }): LetterDocument {
    const now = options.now ?? Date.now();
    const base = letterDocumentSchema.parse({
        id: options.id,
        cvId: content.cv?.id ?? null,
        standalone: !content.cv?.id,
        date: content.date ?? todayIso(now),
        createdAt: now,
        updatedAt: now,
    });
    return applyLetterContent(base, content, now);
}
