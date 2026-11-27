import Dexie, { type Table } from "dexie";
import { type Resume } from "./schema";
import type { LetterDocument, ParagraphEntry } from "./letters/schema";
import { type TemplateDocument } from "./templates/template-schema";
import type { JobApplication, JobApplicationHistoryEntry, SubmissionPacketRecord } from "./jobs/schema";
import type { LetterHistoryEntry, WorkspaceActivityRecord, WorkspaceDocRecord, WorkspaceRecord } from "./workspace/types";

export type { LetterHistoryEntry, WorkspaceActivityRecord, WorkspaceDocRecord, WorkspaceRecord };

export type ResumeHistoryTrigger = "autosave" | "manual" | "import" | "restore" | "duplicate" | "json-edit" | "file-sync";

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
    coverLetters!: Table<LetterDocument, string>; // string = id
    letterParagraphs!: Table<ParagraphEntry, string>; // string = id
    workspace!: Table<WorkspaceRecord, string>; // always one row, id "current"
    workspaceDocs!: Table<WorkspaceDocRecord, string>; // string = CV or letter id
    workspaceActivity!: Table<WorkspaceActivityRecord, number>;
    letterHistory!: Table<LetterHistoryEntry, number>;
    jobApplications!: Table<JobApplication, string>;
    jobSubmissionPackets!: Table<SubmissionPacketRecord, string>;
    jobApplicationHistory!: Table<JobApplicationHistoryEntry, number>;

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
        // The per-CV file link (feature 089) never shipped; the workspace folder replaced it. Drops its table
        // on browsers that already created it.
        this.version(7).stores({
            resumes: "id, updatedAt",
            resumeHistory: "++id, resumeId, createdAt, trigger",
            templates: "id, updatedAt, createdAt",
            linkedFiles: null,
            coverLetters: "id, cvId, updatedAt, status",
            letterParagraphs: "id, updatedAt",
            workspace: "id",
            workspaceDocs: "docId, kind, state",
            workspaceActivity: "++id, at, docId",
            letterHistory: "++id, letterId, createdAt",
        });
        // Job tracker: applications, their frozen submission packets, and restore points taken before an
        // outside change replaces an application. Additive; every earlier table is kept unchanged.
        this.version(8).stores({
            resumes: "id, updatedAt",
            resumeHistory: "++id, resumeId, createdAt, trigger",
            templates: "id, updatedAt, createdAt",
            coverLetters: "id, cvId, updatedAt, status",
            letterParagraphs: "id, updatedAt",
            workspace: "id",
            workspaceDocs: "docId, kind, state",
            workspaceActivity: "++id, at, docId",
            letterHistory: "++id, letterId, createdAt",
            jobApplications: "id, stage, updatedAt, archivedAt, trashedAt",
            jobSubmissionPackets: "id, applicationId, submissionId, capturedAt",
            jobApplicationHistory: "++id, applicationId, createdAt",
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
