import Dexie, { type Table } from "dexie";
import { type Resume } from "./schema";
import { type TemplateDocument } from "./templates/template-schema";

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
