import type { Notice } from "@/lib/agent/authoring/notices";
import type { DocKind, DocReason } from "../types";

/**
 * What the sync engine needs to know about one kind of document. A CV and a letter differ in how
 * their file text is parsed, applied and written; everything else (polling, hashing, queueing,
 * debouncing, busy back-off, divergence) is the same algorithm in `engine.ts`.
 */

export type ParseOutcome<TDoc> =
    | {
        ok: true;
        /** The incoming content as a document, ready for `apply`. */
        doc: TDoc;
        /** The document id written in the file, when there is one. */
        id: string | null;
        /** Repairs and ignored keys, shown to the person. */
        notices: Notice[];
    }
    | { ok: false; reason: DocReason };

export interface ContentChange {
    added: number;
    removed: number;
    changed: number;
}

export type ApplyCheck = { ok: true } | { ok: false; reason: DocReason };

export interface SerializeOptions {
    /** Leave contact fields out of the text (the privacy option). */
    hideContact: boolean;
}

export interface DocumentCodec<TDoc> {
    readonly kind: DocKind;
    /** Validates and converts file text. Never throws; a bad file is `{ ok: false }`. */
    parse(text: string, context: { now: number; hideContact: boolean }): ParseOutcome<TDoc>;
    /** Puts the incoming content onto the current document, keeping what the file never carries. */
    apply(current: TDoc, incoming: TDoc, options: SerializeOptions): TDoc;
    /** The canonical text the app writes: stable layout, id included, newline at the end. */
    serialize(doc: TDoc, options: SerializeOptions): string;
    /** When the document last changed in the app (milliseconds), for deciding which side is newer. */
    updatedAt(doc: TDoc): number;
    /** Entries counted by the shrink guard. */
    entryCount(doc: TDoc): number;
    /** Whether an outside change may be applied to this document right now (a sent letter may not). */
    canApplyExternal(doc: TDoc): ApplyCheck;
    /** What an apply changed, for the one-line summary. */
    describeChange(before: TDoc, after: TDoc): ContentChange;
    /** True when two documents would print the same text, so an apply can be skipped. */
    isSameContent(a: TDoc, b: TDoc): boolean;
}
