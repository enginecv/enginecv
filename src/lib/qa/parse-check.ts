import { toDocumentModel, type DocumentModel } from "../document-model";
import { markdownToPlainText } from "../export-plaintext";
import type { Resume } from "../schema";
import { QA_HIDDEN_MARKER } from "./sample-resumes";

/**
 * Parse-ability checks for exported documents (PDF, DOCX): given the text an
 * extractor pulled out of a file, is every visible field there, in order?
 *
 * Expected fields come from the document model, so visibility, date formatting
 * and headings follow exactly the rules every exporter already uses.
 */

export interface ExpectedField {
    /** Section key ("basics", "experience", "custom:<id>"). */
    section: string;
    /** Marks the first field of a section or entry — the anchors used for order checks. */
    anchor: "section" | "entry" | null;
    text: string;
}

export interface ParseCheckOptions {
    /**
     * Groups of section keys that are read as one continuous flow (for example the
     * main column and the sidebar). Order is only checked within a group. Defaults
     * to a single group containing every section.
     */
    orderGroups?: string[][];
}

export interface ParseCheckResult {
    missingFields: string[];
    /** Pairs of anchors found in the wrong order: [expected first, expected second]. */
    orderErrors: Array<[string, string]>;
    /** Text that must never reach the document (hidden entries). */
    leakedFields: string[];
    pass: boolean;
}

/**
 * NFKC, lower-cased (templates often uppercase headings with CSS, which the
 * extracted text then reflects), no soft hyphens, hyphenated line breaks joined,
 * whitespace collapsed.
 */
export function normalizeExtractedText(value: string): string {
    return value
        .normalize("NFKC")
        .replace(/\u00AD/g, "")
        .replace(/(\p{L})-[ \t]*\r?\n\s*(\p{Ll})/gu, "$1$2")
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleLowerCase();
}

function plainLines(markdown: string): string[] {
    return markdownToPlainText(markdown)
        .split("\n")
        .map((line) => line.replace(/^\s*(?:-|\d+\.)\s+/, "").trim())
        .filter(Boolean);
}

function push(fields: ExpectedField[], section: string, anchor: ExpectedField["anchor"], ...texts: string[]) {
    let currentAnchor = anchor;
    for (const text of texts) {
        const trimmed = text.trim();
        if (!trimmed) continue;
        fields.push({ section, anchor: currentAnchor, text: trimmed });
        currentAnchor = null;
    }
}

export function expectedFieldsFromModel(model: DocumentModel): ExpectedField[] {
    const fields: ExpectedField[] = [];
    const { basics } = model;

    push(
        fields,
        "basics",
        "section",
        basics.name,
        basics.headline,
        ...basics.emails.map((email) => email.value),
        basics.phone,
        basics.location,
        ...basics.details.map((detail) => detail.value),
    );
    if (basics.summary.trim()) {
        push(fields, "basics", null, ...plainLines(basics.summary));
    }

    for (const section of model.sections) {
        push(fields, section.key, "section", section.heading);
        for (const entry of section.entries) {
            push(
                fields,
                section.key,
                "entry",
                entry.title,
                entry.subtitle,
                entry.dateRange,
                entry.location,
            );
            push(
                fields,
                section.key,
                null,
                ...(entry.body.trim() ? plainLines(entry.body) : entry.bullets),
                ...entry.tags,
                ...entry.details.map((detail) => detail.value),
            );
        }
        for (const group of section.skillGroups) {
            push(fields, section.key, null, group.name, ...group.skills);
        }
        if (section.text.trim()) push(fields, section.key, null, ...plainLines(section.text));
        push(fields, section.key, null, ...section.tags);
    }

    return fields;
}

export function expectedFieldsInOrder(resume: Resume): ExpectedField[] {
    return expectedFieldsFromModel(toDocumentModel(resume));
}

export function checkExtractedText(
    extracted: string,
    expected: ExpectedField[],
    options: ParseCheckOptions = {},
): ParseCheckResult {
    const haystack = normalizeExtractedText(extracted);

    const missingFields = expected
        .map((field) => normalizeExtractedText(field.text))
        .filter((text) => !haystack.includes(text));

    const leakedFields = haystack.includes(normalizeExtractedText(QA_HIDDEN_MARKER)) ? [QA_HIDDEN_MARKER] : [];

    const allSections = [...new Set(expected.map((field) => field.section))];
    const groups = options.orderGroups ?? [allSections];
    const orderErrors: Array<[string, string]> = [];

    for (const group of groups) {
        const members = new Set(group);
        let previous: { text: string; index: number } | null = null;
        for (const field of expected) {
            if (!field.anchor || !members.has(field.section)) continue;
            const text = normalizeExtractedText(field.text);
            const firstIndex = haystack.indexOf(text);
            if (firstIndex === -1) continue; // reported as missing
            // Short anchors ("Skills") can also occur inside earlier text, so look
            // for an occurrence after the previous anchor before calling it out of order.
            const index: number = previous ? haystack.indexOf(text, previous.index + 1) : firstIndex;
            if (previous && index === -1) {
                orderErrors.push([previous.text, text]);
                previous = { text, index: firstIndex };
                continue;
            }
            previous = { text, index };
        }
    }

    return {
        missingFields,
        orderErrors,
        leakedFields,
        pass: missingFields.length === 0 && orderErrors.length === 0 && leakedFields.length === 0,
    };
}
