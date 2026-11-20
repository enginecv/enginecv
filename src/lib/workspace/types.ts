import type { LetterDocument } from "@/lib/letters/schema";

/**
 * Shared vocabulary of the workspace folder (feature 091): what a document's sync state can be,
 * why a file was refused, and the rows kept in the database. Pure types and constants only, so
 * `db.ts` and the UI can import it without pulling in browser file access.
 */

export type DocKind = "cv" | "letter";

export type DocState =
    | "in-sync"
    | "paused"
    | "needs-permission"
    | "blocked"
    | "review"
    | "busy"
    | "detached"
    | "broken";

/** Closed set of reasons used for copy, the activity list, logs and result files. */
export const REASON_CODES = [
    "applied",
    "empty",
    "too-large",
    "no-document",
    "invalid-json",
    "cut-off",
    "full-export",
    "newer-version",
    "invalid-field",
    "shrink-guard",
    "sent-letter",
    "duplicate-id",
    "name-clash",
    "reserved-name",
    "file-missing",
    "file-busy",
    "storage-full",
    "permission",
    "folder-missing",
    "unknown-cv",
    "conflict-copy",
    "request-invalid",
    "request-expired",
    "unknown-document",
    "format-unavailable",
    "export-failed",
    "exported",
    "undone",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export interface DocReason {
    code: ReasonCode;
    line?: number;
    column?: number;
    /** Codes, counts, paths and ids only; never document text (FR-050). */
    detail?: string;
}

export type ActivityKind = "accepted" | "refused" | "review" | "info";

export type ChangeSourceKind = "observer" | "poll";

/** The one workspace of this browser profile. `id` is always `"current"`. */
export interface WorkspaceRecord {
    id: "current";
    handle: FileSystemDirectoryHandle;
    folderName: string;
    createdAt: number;
    formatVersion: 1;
    hideContact: boolean;
    paused: boolean;
    changeSource: ChangeSourceKind;
    /** File names the person chose to ignore (conflict copies, duplicates they decided about). */
    ignoredFiles?: string[];
    /** Show a notification when something changes in the folder. On unless set to false. */
    notify?: boolean;
}

export interface FileStampRecord {
    lastModified: number;
    size: number;
}

export interface PendingReview {
    removed: string[];
    keptCount: number;
    previousCount: number;
    at: number;
    /** The agent that signed the file, when it did. */
    agent?: string | null;
}

export interface WorkspaceDocRecord {
    docId: string;
    kind: DocKind;
    fileName: string | null;
    /** The document title the file name was last derived from. The file is renamed only when the title changes, so a rename in the file manager sticks. */
    fileTitle?: string;
    included: boolean;
    state: DocState;
    lastHash: string | null;
    lastStamp: FileStampRecord | null;
    reason: DocReason | null;
    pendingReview: PendingReview | null;
    updatedAt: number;
}

export interface WorkspaceActivityRecord {
    id?: number;
    at: number;
    docId: string | null;
    kind: ActivityKind;
    reason: { code: ReasonCode; detail?: string };
    restoreId: number | null;
    restoreKind: DocKind | null;
    /** The change was undone from the activity list. */
    undone?: boolean;
}

export type LetterHistoryTrigger = "autosave" | "file-sync" | "manual";

export interface LetterHistoryEntry {
    id?: number;
    letterId: string;
    createdAt: number;
    trigger: LetterHistoryTrigger;
    letter: LetterDocument;
}

/** Activity rows kept; older ones are dropped on insert. */
export const ACTIVITY_CAP = 500;
/** Documents scanned per workspace, files above this are listed as skipped. */
export const MAX_DOCUMENTS = 500;
/** Largest document file read (same as the authoring text cap). */
export const MAX_FILE_BYTES = 200 * 1024;
