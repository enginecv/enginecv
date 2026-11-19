import { nameKey, parseDocumentFileName } from "./names";
import { MAX_DOCUMENTS, MAX_FILE_BYTES, type DocKind } from "./types";

/**
 * Pure classification of what a folder listing holds. The directory adapter lists `cvs/` and
 * `letters/`; this decides which entries are documents, which are sync-tool conflict copies, which
 * are skipped, and which are not workspace files at all. It never reads file content.
 */

export interface ListedFile {
    name: string;
    size: number;
    lastModified: number;
}

export interface ScannedDocument extends ListedFile {
    kind: DocKind;
    /** The name without the `.cv.json` or `.letter.json` extension. */
    stem: string;
}

export interface ConflictCopy {
    fileName: string;
    kind: DocKind;
    /** The file this looks like a copy of, when it exists in the same folder. */
    original: string | null;
}

export interface ScanResult {
    documents: ScannedDocument[];
    conflictCopies: ConflictCopy[];
    /** Documents left out: too large, or beyond the cap. */
    skipped: { fileName: string; reason: "too-large" | "over-limit" }[];
    /** Files in a document folder that are not workspace documents. */
    notWorkspaceFiles: string[];
}

const CONFLICT_PATTERNS: RegExp[] = [
    /\((?:[^)]* )?conflicted copy[^)]*\)/i, // Dropbox
    /\.sync-conflict-\d{8}-\d{6}/i, // Syncthing
    /-(?:DESKTOP|LAPTOP|PC|MACBOOK)-[A-Z0-9]{3,}(?=\.(?:cv|letter)\.json$)/i, // OneDrive
];

/** Entries the browser or a sync tool leaves behind: ignored without comment. */
export function isIgnoredName(name: string): boolean {
    return name.endsWith(".crswap") || name.startsWith(".") || name.startsWith("~$") || name.endsWith("~");
}

function originalOf(name: string, kind: DocKind, present: ReadonlySet<string>): string | null {
    const extension = kind === "cv" ? ".cv.json" : ".letter.json";
    const candidates = [
        name.replace(/ \((?:[^)]* )?conflicted copy[^)]*\)/i, ""),
        name.replace(/\.sync-conflict-\d{8}-\d{6}(?:-[A-Z0-9]+)?/i, ""),
        name.replace(/-(?:DESKTOP|LAPTOP|PC|MACBOOK)-[A-Z0-9]{3,}(?=\.(?:cv|letter)\.json$)/i, ""),
        name.replace(/ \(\d+\)(?=\.(?:cv|letter)\.json$)/, ""),
    ];
    for (const candidate of candidates) {
        if (candidate !== name && candidate.toLowerCase().endsWith(extension) && present.has(nameKey(candidate))) return candidate;
    }
    return null;
}

function looksLikeConflictCopy(name: string, kind: DocKind, present: ReadonlySet<string>): boolean {
    if (CONFLICT_PATTERNS.some((pattern) => pattern.test(name))) return true;
    // "name (1).cv.json" is only a copy when "name.cv.json" is also there.
    return / \(\d+\)\.(?:cv|letter)\.json$/i.test(name) && originalOf(name, kind, present) !== null;
}

export function classifyListing(listing: { cvs?: readonly ListedFile[]; letters?: readonly ListedFile[] }): ScanResult {
    const result: ScanResult = { documents: [], conflictCopies: [], skipped: [], notWorkspaceFiles: [] };
    const folders: Array<[DocKind, readonly ListedFile[]]> = [
        ["cv", listing.cvs ?? []],
        ["letter", listing.letters ?? []],
    ];

    for (const [folderKind, files] of folders) {
        const present = new Set(files.filter((file) => !isIgnoredName(file.name)).map((file) => nameKey(file.name)));
        const sorted = [...files].filter((file) => !isIgnoredName(file.name)).sort((a, b) => a.name.localeCompare(b.name));
        for (const file of sorted) {
            const parsed = parseDocumentFileName(file.name);
            if (!parsed || parsed.kind !== folderKind) {
                result.notWorkspaceFiles.push(file.name);
                continue;
            }
            if (looksLikeConflictCopy(file.name, parsed.kind, present)) {
                result.conflictCopies.push({ fileName: file.name, kind: parsed.kind, original: originalOf(file.name, parsed.kind, present) });
                continue;
            }
            if (file.size > MAX_FILE_BYTES) {
                result.skipped.push({ fileName: file.name, reason: "too-large" });
                continue;
            }
            if (result.documents.length >= MAX_DOCUMENTS) {
                result.skipped.push({ fileName: file.name, reason: "over-limit" });
                continue;
            }
            result.documents.push({ ...file, kind: parsed.kind, stem: parsed.stem });
        }
    }
    return result;
}
