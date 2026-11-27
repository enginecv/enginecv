"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { cvTitle, letterTitle } from "@/lib/jobs/submissions";
import type { LetterStatus } from "@/lib/letters/schema";

export interface CvChoice {
    id: string;
    title: string;
    language: string;
    updatedAt: number;
}

export interface LetterChoice {
    id: string;
    title: string;
    language: string;
    updatedAt: number;
    status: LetterStatus;
    /** The CV this letter follows; null for a standalone letter. */
    cvId: string | null;
    standalone: boolean;
}

/**
 * The CVs and letters in this browser, newest first, as the pickers show them. Only the light fields are
 * kept, so the Job Tracker never holds whole documents in memory for a list.
 */
export function useDocumentChoices(untitled: string): { cvs: CvChoice[] | undefined; letters: LetterChoice[] | undefined } {
    const cvs = useLiveQuery(async () => {
        const rows = await db.resumes.toArray();
        return rows
            .map((row) => ({ id: row.id as string, title: cvTitle(row) || untitled, language: row.settings?.language ?? "", updatedAt: row.updatedAt ?? 0 }))
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }, [untitled]);
    const letters = useLiveQuery(async () => {
        const rows = await db.coverLetters.toArray();
        return rows
            .map((row) => ({
                id: row.id,
                title: letterTitle(row) || untitled,
                language: row.language,
                updatedAt: row.updatedAt,
                status: row.status,
                cvId: row.cvId ?? null,
                standalone: Boolean(row.standalone),
            }))
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }, [untitled]);
    return { cvs, letters };
}
