import { db } from "@/lib/db";
import { recordResumeHistory } from "@/lib/history";
import { persistImportedResume } from "@/lib/import/persist-imported-resume";
import { resumeSchema, type Language } from "@/lib/schema";
import { mergeAssessmentIntoResume, resumeFromAssessment, type MergeOutcome } from "@/lib/tools/cefr-assessment";

/** Saves a new resume holding only the assessed language and returns its id. */
export function saveAssessmentToNewResume(entry: Language): Promise<string> {
    return persistImportedResume(resumeFromAssessment(entry));
}

/**
 * Adds the assessed language to an existing resume, or updates that language's
 * levels. The change is recorded in the resume's history, so it can be undone
 * from there like any other edit. A "native" outcome leaves the resume untouched.
 */
export async function saveAssessmentToResume(resumeId: string, entry: Language): Promise<MergeOutcome> {
    const stored = await db.resumes.get(resumeId);
    if (!stored) throw new Error(`Resume ${resumeId} not found`);

    const { resume, outcome } = mergeAssessmentIntoResume(resumeSchema.parse(stored), entry);
    if (outcome === "native") return outcome;

    const updated = resumeSchema.parse({ ...resume, id: resumeId, updatedAt: Date.now() });
    await db.resumes.put(updated);
    await recordResumeHistory(updated, "manual");
    return outcome;
}
