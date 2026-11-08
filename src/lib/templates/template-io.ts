import {
    templateDocumentSchema,
    type TemplateDocument,
} from "./template-schema";

/**
 * Plan calls for an explicit `kind: "template"` discriminator so import code
 * never confuses templates with resumes.
 */
export function exportTemplateToJson(template: TemplateDocument): string {
    return JSON.stringify(template, null, 2);
}

export function importTemplateFromJsonText(text: string): TemplateDocument {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error("Template file is not valid JSON.");
    }
    if (!parsed || typeof parsed !== "object" || (parsed as { kind?: unknown }).kind !== "template") {
        throw new Error("File is not a template (missing kind: 'template').");
    }
    const result = templateDocumentSchema.safeParse(parsed);
    if (!result.success) {
        throw new Error(`Template did not match the expected schema: ${result.error.message}`);
    }
    return result.data;
}
