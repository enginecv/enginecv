import { db } from "../db";
import { recordResumeHistory } from "../history";
import { createId } from "../id";
import { createEmptyResume, resumeSchema } from "../schema";
import { getBuiltinTemplates, isBuiltinTemplateId } from "./enginecv-templates";
import { applyTemplateToResume } from "./template-apply";
import { templateDocumentSchema, type TemplateDocument } from "./template-schema";

async function resolveTemplate(templateId: string): Promise<TemplateDocument | undefined> {
    if (isBuiltinTemplateId(templateId)) {
        return getBuiltinTemplates().find((template) => template.id === templateId);
    }

    return db.templates.get(templateId);
}

export async function createResumeFromTemplate(templateId: string): Promise<string> {
    const rawTemplate = await resolveTemplate(templateId);
    if (!rawTemplate) {
        throw new Error(`Template "${templateId}" not found.`);
    }

    const template = templateDocumentSchema.parse(rawTemplate);
    const { resume: appliedResume } = applyTemplateToResume(createEmptyResume(), template);
    const id = createId();
    const now = Date.now();
    const resume = resumeSchema.parse({
        ...appliedResume,
        id,
        createdAt: now,
        updatedAt: now,
    });

    await db.resumes.add(resume);
    await recordResumeHistory(resume, "manual");

    return id;
}
