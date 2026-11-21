import type { Notice } from "@/lib/agent/authoring/notices";
import { applyLetterContent, letterFromContent } from "@/lib/letters/apply-content";
import { letterFileText, parseLetterText, type LetterFileContent } from "@/lib/letters/file-format";
import type { LetterDocument } from "@/lib/letters/schema";
import type { DocumentCodec, ParseOutcome } from "./types";

/**
 * How a letter is read from and written to a workspace file. Parsing is `parseLetterText`, applying is
 * `applyLetterContent` (a field the file leaves out stays as it is), and writing is `letterFileText`.
 *
 * The engine hands `apply` a document, but a letter file can leave fields out, which a finished
 * document cannot say. So `parse` remembers the file's own content next to the document it builds and
 * `apply` reads it back from there.
 */

const contentOf = new WeakMap<LetterDocument, LetterFileContent>();

export interface LetterCodecOptions {
    /** Title of the CV a letter names, written beside its id as a hint for humans. */
    cvTitle?: (cvId: string) => string | undefined;
}

const INCOMING_ID = "incoming";

export function createLetterCodec(options: LetterCodecOptions = {}): DocumentCodec<LetterDocument> {
    const canonicalText = (doc: LetterDocument) => codec.serialize(doc, { hideContact: false });

    const codec: DocumentCodec<LetterDocument> = {
        kind: "letter",

        parse(text, { now }): ParseOutcome<LetterDocument> {
            const parsed = parseLetterText(text);
            if (!parsed.ok) return parsed;
            let doc: LetterDocument;
            try {
                doc = letterFromContent(parsed.content, { id: parsed.id ?? INCOMING_ID, now });
            } catch {
                return { ok: false, reason: { code: "invalid-field" } };
            }
            contentOf.set(doc, parsed.content);
            const notices: Notice[] = [...parsed.notices];
            return { ok: true, doc, id: parsed.id, notices };
        },

        apply(current, incoming, { hideContact }) {
            const content = contentOf.get(incoming);
            if (!content) return incoming;
            // The file does not carry sender details when they are left out, so whatever it holds there is ignored.
            const effective = hideContact ? { ...content, sender: undefined } : content;
            return applyLetterContent(current, effective, Math.max(current.updatedAt + 1, Date.now()));
        },

        serialize(doc, { hideContact }) {
            return letterFileText(doc, { hideContact, cvTitle: doc.cvId ? options.cvTitle?.(doc.cvId) : undefined });
        },

        updatedAt: (doc) => doc.updatedAt,
        entryCount: (doc) => doc.paragraphs.length,
        canApplyExternal: (doc) => (doc.status === "draft" ? { ok: true } : { ok: false, reason: { code: "sent-letter" } }),

        describeChange(before, after) {
            const a = new Map(before.paragraphs.map((paragraph) => [paragraph.id, paragraph.markdown]));
            let added = 0;
            let changed = 0;
            for (const paragraph of after.paragraphs) {
                if (!a.has(paragraph.id)) added += 1;
                else if (a.get(paragraph.id) !== paragraph.markdown) changed += 1;
            }
            const kept = new Set(after.paragraphs.map((paragraph) => paragraph.id));
            const removed = before.paragraphs.filter((paragraph) => !kept.has(paragraph.id)).length;
            // Fields other than the paragraphs (subject, recipient, ...) count as one changed entry when any moved.
            const sameFields = JSON.stringify({ ...before, paragraphs: 0, updatedAt: 0, lastResolved: 0 }) === JSON.stringify({ ...after, paragraphs: 0, updatedAt: 0, lastResolved: 0 });
            return { added, removed, changed: changed + (sameFields ? 0 : 1) };
        },

        // Same content means the same text in the file: normalisation a round trip causes does not count as a change.
        isSameContent: (a, b) => canonicalText(a) === canonicalText(b),
    };
    return codec;
}
