import Dexie, { type Table } from "dexie";
import { type Resume } from "./schema";
import type { LetterDocument, ParagraphEntry } from "./letters/schema";
import { type TemplateDocument } from "./templates/template-schema";
import type { LetterHistoryEntry, WorkspaceActivityRecord, WorkspaceDocRecord, WorkspaceRecord } from "./workspace/types";

export type { LetterHistoryEntry, WorkspaceActivityRecord, WorkspaceDocRecord, WorkspaceRecord };

export type ResumeHistoryTrigger = "autosave" | "manual" | "import" | "restore" | "duplicate" | "json-edit" | "file-sync";

/** A CV linked to a file on disk (feature 089). Never exported: a handle only means something in this browser. */
export interface LinkedFileRecord {
    resumeId: string;
    handle: FileSystemFileHandle;
    fileName: string;
    linkedAt: number;
    paused: boolean;
}

export interface ResumeHistoryEntry {
    id?: number;
    resumeId: string;
    createdAt: number;
    trigger: ResumeHistoryTrigger;
    resumeJson: string;
}

class ResumeDatabase extends Dexie {
    resumes!: Table<Resume, string>; // string = id
    resumeHistory!: Table<ResumeHistoryEntry, number>;
    templates!: Table<TemplateDocument, string>; // string = id
    linkedFiles!: Table<LinkedFileRecord, string>; // string = resume id
    coverLetters!: Table<LetterDocument, string>; // string = id
    letterParagraphs!: Table<ParagraphEntry, string>; // string = id
    workspace!: Table<WorkspaceRecord, string>; // always one row, id "current"
    workspaceDocs!: Table<WorkspaceDocRecord, string>; // string = CV or letter id
    workspaceActivity!: Table<WorkspaceActivityRecord, number>;
    letterHistory!: Table<LetterHistoryEntry, number>;

    constructor() {
        super("EngineCVDatabase");

        // Define tables and indexes
        this.version(1).stores({
            resumes: "id, updatedAt", // Primary key and indexed props
        });

        this.version(2).stores({
            resumes: "id, updatedAt",
            resumeHistory: "++id, resumeId, createdAt, trigger",
        });

        this.version(3).stores({
            resumes: "id, updatedAt",
            resumeHistory: "++id, resumeId, createdAt, trigger",
            templates: "id, updatedAt, createdAt",
        });

        this.version(4).stores({
            resumes: "id, updatedAt",
            resumeHistory: "++id, resumeId, createdAt, trigger",
            templates: "id, updatedAt, createdAt",
            linkedFiles: "resumeId",
        });

        // Cover letters (feature 090). Version 4 is the linked-files table; this one adds the
        // letters and the saved-paragraph library on top and keeps every earlier table.
        this.version(5).stores({
            resumes: "id, updatedAt",
            resumeHistory: "++id, resumeId, createdAt, trigger",
            templates: "id, updatedAt, createdAt",
            linkedFiles: "resumeId",
            coverLetters: "id, cvId, updatedAt, status",
            letterParagraphs: "id, updatedAt",
        });

        // Workspace folder (feature 091): the folder handle, per-document sync state, a capped
        // activity log and restore points for letters. Every earlier table is kept.
        this.version(6).stores({
            resumes: "id, updatedAt",
            resumeHistory: "++id, resumeId, createdAt, trigger",
            templates: "id, updatedAt, createdAt",
            linkedFiles: "resumeId",
            coverLetters: "id, cvId, updatedAt, status",
            letterParagraphs: "id, updatedAt",
            workspace: "id",
            workspaceDocs: "docId, kind, state",
            workspaceActivity: "++id, at, docId",
            letterHistory: "++id, letterId, createdAt",
        });
    }
}

export const db = new ResumeDatabase();

/**
 * Closes the database so it can be deleted, and keeps Dexie from quietly
 * reopening (and so recreating) it afterwards. Used by "delete all my data";
 * the tab reloads right after.
 */
export function closeDatabaseForDeletion() {
    db.close({ disableAutoOpen: true });
}
