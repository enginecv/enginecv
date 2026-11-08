import { resumeObjectSchema, resumeSchema, type Resume } from "@/lib/schema";
import { createId } from "@/lib/id";
import { isAuthoringDocument } from "@/lib/agent/authoring/detect";
import { errorPosition } from "@/lib/agent/authoring/parse-text";
import { NoticeList, type Notice, type PathSegment } from "@/lib/agent/authoring/notices";
import { PHOTO_TOKEN } from "./serialize";
import { problemAt, zodIssueToProblem, type Problem } from "./problems";
import { buildResumeJsonSchema, schemaAt, unknownKeyPaths } from "./schema-help";

export const MAX_JSON_EDIT_BYTES = 2 * 1024 * 1024;
export interface ValidationResult {
    status: "valid" | "invalid";
    candidate?: Resume;
    problems: Problem[];
    notices: Notice[];
}
export interface ValidationContext { snapshot: Resume; photo: string; resumeId: string }

export function validateBuffer(text: string, ctx: ValidationContext): ValidationResult {
    const notices = new NoticeList();
    const problems: Problem[] = [];
    const invalid = (): ValidationResult => ({ status: "invalid", problems, notices: notices.items });
    if (!text.trim()) { problems.push(problemAt(text, "empty")); return invalid(); }
    if (new TextEncoder().encode(text).length > MAX_JSON_EDIT_BYTES) { problems.push(problemAt(text, "too-large")); return invalid(); }
    let value: Record<string, unknown>;
    try { value = JSON.parse(text); }
    catch (error) {
        const pos = errorPosition(error as Error, text);
        const offset = text.split("\n").slice(0, pos.line - 1).reduce((sum, line) => sum + line.length + 1, 0) + pos.column - 1;
        problems.push(problemAt(text, "syntax", [], {}, offset));
        return invalid();
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) { problems.push(problemAt(text, "not-object")); return invalid(); }
    if (isAuthoringDocument(value)) { problems.push(problemAt(text, "authoring-format")); return invalid(); }
    for (const key of ["id", "version", "createdAt"] as const) {
        const original = key === "id" ? ctx.resumeId : ctx.snapshot[key];
        if (value[key] !== original) notices.add("adjusted", "protected-field", [key]);
        value[key] = original;
    }
    const basics = value.basics;
    if (basics && typeof basics === "object" && !Array.isArray(basics) && "photo" in basics && basics.photo === PHOTO_TOKEN) {
        basics.photo = ctx.photo;
        notices.add("adjusted", "photo-kept", ["basics", "photo"]);
    }
    const schema = buildResumeJsonSchema();
    for (const path of unknownKeyPaths(value, schema)) problems.push(problemAt(text, "unknown-key", path));
    const inspect = (item: unknown, path: PathSegment[]) => {
        if (!item || typeof item !== "object") return;
        if (Array.isArray(item)) {
            const entrySchema = schemaAt(schema, [...path, 0]);
            if (entrySchema?.properties?.id) {
                const ids = new Set<string>();
                item.forEach((entry, i) => {
                    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
                    const idPath = [...path, i, "id"];
                    if (entry.id === undefined || entry.id === "") {
                        const previousId = String(entry.id ?? "");
                        entry.id = createId();
                        notices.add("adjusted", "id-regenerated", idPath, { value: previousId });
                    }
                    if (typeof entry.id === "string") {
                        if (ids.has(entry.id)) problems.push(problemAt(text, "duplicate-id", idPath));
                        ids.add(entry.id);
                    }
                });
            }
            item.forEach((entry, i) => inspect(entry, [...path, i]));
        } else for (const [key, child] of Object.entries(item)) inspect(child, [...path, key]);
    };
    try { inspect(value, []); }
    catch { problems.push(problemAt(text, "invalid-value")); return invalid(); }
    const parsed = resumeObjectSchema.safeParse(value);
    if (!parsed.success) {
        for (const issue of parsed.error.issues) {
            const mapped = zodIssueToProblem(issue);
            problems.push(problemAt(text, mapped.code, mapped.path, mapped.params));
        }
        return invalid();
    }
    if (problems.length) return invalid();
    const final = resumeSchema.safeParse({ ...parsed.data, id: ctx.resumeId });
    if (!final.success) {
        for (const issue of final.error.issues) {
            const mapped = zodIssueToProblem(issue);
            problems.push(problemAt(text, mapped.code, mapped.path, mapped.params));
        }
        return invalid();
    }
    return { status: "valid", candidate: final.data, problems, notices: notices.items };
}
