import { db } from "@/lib/db";
import { recordResumeHistory } from "@/lib/history";
import { createId } from "@/lib/id";
import { resumeSchema, type Resume } from "@/lib/schema";

/** Saves a mapped import as a brand-new resume and returns its id. */
export async function persistImportedResume(mappedResume: Resume): Promise<string> {
    const id = createId();
    const now = Date.now();
    const resume = resumeSchema.parse({
        ...mappedResume,
        id,
        createdAt: now,
        updatedAt: now,
    });

    await db.resumes.add(resume);
    await recordResumeHistory(resume, "manual");
    return id;
}
