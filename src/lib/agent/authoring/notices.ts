/**
 * Everything the authoring importer repaired, adjusted, skipped or wants a
 * human to look at. The domain module never produces UI text: each notice is
 * a code plus params, and the UI renders `authoring.notice.<code>`.
 */

/**
 * repaired = the text was fixed before it could be read;
 * adjusted = a value was normalised into the stored form;
 * skipped  = a value was dropped;
 * review   = a value was kept but is worth checking.
 */
export type NoticeKind = "repaired" | "adjusted" | "skipped" | "review";

export const NOTICE_CODES = [
    // Text repairs (parseAuthoringText)
    "code-fence",
    "surrounding-text",
    "multiple-documents",
    "smart-quotes",
    "trailing-comma",
    "comments",
    "unquoted-keys",
    // Document level
    "format-missing",
    "format-unknown",
    "newer-version",
    "section-renamed",
    "unknown-key-to-custom",
    "photo-ignored",
    // Entries and values
    "field-renamed",
    "unknown-field-to-description",
    "unknown-field-skipped",
    "id-regenerated",
    "protected-field",
    "duplicate-id",
    "photo-kept",
    "entry-invalid",
    "value-invalid",
    "value-coerced",
    "list-split",
    "highlights-split",
    "date-normalised",
    "date-unparsed",
    "link-normalised",
    "email-invalid",
    "skill-normalised",
    "skill-level-unknown",
    "language-normalised",
    "language-level-unrecognised",
    "custom-title-missing",
    // Design hints
    "template-unknown",
    "accent-invalid",
    "cv-language-unknown",
    "design-hint-unknown",
] as const;

export type NoticeCode = (typeof NOTICE_CODES)[number];

export interface Notice {
    kind: NoticeKind;
    /** Where in the document: `experience[1].start`, `skills.Frontend[2]`, `(document)`. */
    path: string;
    code: NoticeCode;
    /** Values for the localized message, e.g. `{ value: "spring 2021" }`. */
    params: Record<string, string>;
}

/** A notice not yet tied to a place in the document (value parsers return these). */
export type Issue = Omit<Notice, "path">;

export type PathSegment = string | number;

export const DOCUMENT_PATH = "(document)";

const PLAIN_KEY = /^[\p{L}\p{N}_$-]+$/u;

export function formatPath(segments: readonly PathSegment[]): string {
    if (segments.length === 0) return DOCUMENT_PATH;
    let out = "";
    for (const segment of segments) {
        if (typeof segment === "number") {
            out += `[${segment}]`;
        } else if (PLAIN_KEY.test(segment)) {
            out += out ? `.${segment}` : segment;
        } else {
            out += `[${JSON.stringify(segment)}]`;
        }
    }
    return out;
}

export function issue(kind: NoticeKind, code: NoticeCode, params: Record<string, string> = {}): Issue {
    return { kind, code, params };
}

/** Collects notices while a document is walked. */
export class NoticeList {
    readonly items: Notice[] = [];

    add(kind: NoticeKind, code: NoticeCode, path: readonly PathSegment[], params: Record<string, string> = {}) {
        this.items.push({ kind, code, path: formatPath(path), params });
    }

    addIssue(found: Issue | undefined, path: readonly PathSegment[]) {
        if (found) this.items.push({ ...found, path: formatPath(path) });
    }
}
