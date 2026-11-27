import { DOC_KINDS, type DocKind, type ReasonCode } from "./types";

/**
 * File names in a workspace folder. A name that is legal in the browser can be illegal or colliding on
 * the disk (Windows and macOS fold case, Windows refuses `con`, trailing dots and spaces), so names are
 * made safe before they are written and compared without regard to case.
 */

const MAX_STEM_LENGTH = 120;
const FALLBACK_STEM = "untitled";
// Characters Windows refuses in a file name, plus control characters.
const ILLEGAL = /[\/:*?"<>|\u0000-\u001f\u007f]/g;
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export const EXTENSIONS: Record<DocKind, string> = { cv: ".cv.json", letter: ".letter.json", application: ".application.json" };
/** The folder each kind of document lives in. */
export const FOLDERS: Record<DocKind, string> = { cv: "cvs", letter: "letters", application: "applications" };

export function folderOf(kind: DocKind): string {
    return FOLDERS[kind];
}

/** `cvs/name.cv.json`, for logs and result files. */
export function filePath(kind: DocKind, fileName: string): string {
    return `${FOLDERS[kind]}/${fileName}`;
}

/** A safe file stem for a document title. */
export function safeStem(title: string): string {
    let stem = title.normalize("NFC").replace(ILLEGAL, "").replace(/\s+/g, " ").trim();
    stem = stem.replace(/^[. ]+|[. ]+$/g, "");
    if (stem.length > MAX_STEM_LENGTH) stem = stem.slice(0, MAX_STEM_LENGTH).replace(/[. ]+$/g, "");
    if (!stem) return FALLBACK_STEM;
    // Windows treats "con", "con.txt" and the like as devices whatever follows; a leading underscore avoids it.
    if (RESERVED.test(stem)) return `_${stem}`;
    return stem;
}

/** The key two names are compared by: Unicode-normalised and lower-cased. */
export function nameKey(name: string): string {
    return name.normalize("NFC").toLowerCase();
}

/** Reason a name must not be written, or null when it is fine. */
export function nameProblem(name: string): ReasonCode | null {
    const stem = name.replace(/\.(cv|letter|application)\.json$/i, "");
    if (RESERVED.test(stem) || RESERVED.test(name)) return "reserved-name";
    if (/[. ]$/.test(name) || /^[. ]/.test(stem) || ILLEGAL.test(name) || name.length > MAX_STEM_LENGTH + 20) {
        ILLEGAL.lastIndex = 0;
        return "reserved-name";
    }
    ILLEGAL.lastIndex = 0;
    return null;
}

export function documentFileName(stem: string, kind: DocKind): string {
    return `${stem}${EXTENSIONS[kind]}`;
}

/** The kind and stem a file name stands for, or null when it is not a workspace document name. */
export function parseDocumentFileName(name: string): { kind: DocKind; stem: string } | null {
    const lower = name.toLowerCase();
    for (const kind of DOC_KINDS) {
        const extension = EXTENSIONS[kind];
        if (lower.endsWith(extension) && name.length > extension.length) return { kind, stem: name.slice(0, -extension.length) };
    }
    return null;
}

/**
 * A file name for `title` that does not clash (case-insensitively) with any key in `takenKeys`:
 * `name.cv.json`, then `name-2.cv.json`, `name-3.cv.json`, ...
 */
export function uniqueFileName(title: string, kind: DocKind, takenKeys: ReadonlySet<string>): string {
    const stem = safeStem(title);
    let candidate = documentFileName(stem, kind);
    for (let n = 2; takenKeys.has(nameKey(candidate)); n += 1) candidate = documentFileName(`${stem}-${n}`, kind);
    return candidate;
}

/** True when `name` collides with a name in `takenKeys`, ignoring case. */
export function isNameClash(name: string, takenKeys: ReadonlySet<string>): boolean {
    return takenKeys.has(nameKey(name));
}

export function keysOf(names: Iterable<string>): Set<string> {
    return new Set([...names].map(nameKey));
}
