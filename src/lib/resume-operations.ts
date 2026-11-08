import { db } from "./db";
import { recordResumeHistory } from "./history";
import { createId } from "./id";
import { resumeSchema, type Resume } from "./schema";

export async function duplicateResume(
    source: Resume,
    copyLabel: string,
): Promise<string> {
    const now = Date.now();
    const id = createId();
    const clone = structuredClone(source);
    const resume = resumeSchema.parse({
        ...clone,
        id,
        createdAt: now,
        updatedAt: now,
        meta: {
            ...clone.meta,
            title: clone.meta?.title
                ? `${clone.meta.title} (${copyLabel})`
                : copyLabel,
        },
    });

    await db.resumes.add(resume);
    await recordResumeHistory(resume, "duplicate");
    return id;
}
