import { repairJsonText, type ParseErrorCode } from "@/lib/agent/authoring/parse-text";
import { NoticeList, formatPath, type Notice, type PathSegment } from "@/lib/agent/authoring/notices";
import { parseHumanDate, normaliseLink, parseLanguageLevel, normaliseSkillLevel, type Parsed } from "@/lib/agent/authoring/values";
import { buildResumeJsonSchema, schemaAt, unknownKeyPaths } from "./schema-help";
import { MAX_JSON_EDIT_BYTES } from "./validate";
import { isAuthoringDocument } from "@/lib/agent/authoring/detect";

export interface CleanResult {
    status: "ok" | "blocked";
    text?: string;
    notices: Notice[];
    error?: { code: ParseErrorCode; line?: number; column?: number };
    authoring?: boolean;
}

/** Stored paths only: prose and unrelated settings never receive value repair. */
export const STORED_FIELD_RULES: ReadonlyArray<{ path: RegExp; normalise: (text: string) => Parsed<string> }> = [
    { path: /^(?:experience|education|courses|projects|organisations)\[\d+\]\.(?:start|end)$/, normalise: parseHumanDate },
    // Declaration dates are deliberately free-form, unlike dateSchema fields.
    { path: /^(?:certificates|awards|publications)\[\d+\]\.date$/, normalise: parseHumanDate },
    { path: /^customSections\[\d+\]\.entries\[\d+\]\.(?:start|end)$/, normalise: parseHumanDate },
    { path: /^basics\.dateOfBirth$/, normalise: parseHumanDate },
    { path: /^basics\.(?:website|linkedin|github)$/, normalise: normaliseLink },
    { path: /^basics\.customLinks\[\d+\]\.url$/, normalise: normaliseLink },
    { path: /^(?:experience|education|courses|projects|organisations|certificates|awards|publications|references)\[\d+\]\.(?:url|issuerUrl)$/, normalise: normaliseLink },
    { path: /^projects\[\d+\]\.repos\[\d+\]\.url$/, normalise: normaliseLink },
    { path: /^customSections\[\d+\]\.entries\[\d+\]\.url$/, normalise: normaliseLink },
    { path: /^languages\[\d+\]\.assessmentUrl$/, normalise: normaliseLink },
    { path: /^languages\[\d+\]\.fluency$/, normalise: parseLanguageLevel },
    { path: /^skillGroups\[\d+\]\.skills\[\d+\]\.level$/, normalise: normaliseSkillLevel },
];

export function cleanBuffer(text: string): CleanResult {
    const repaired = repairJsonText(text, { maxBytes: MAX_JSON_EDIT_BYTES });
    if (repaired.status === "blocked") return repaired;
    const notices = new NoticeList(); notices.items.push(...repaired.notices);
    const schema = buildResumeJsonSchema();
    const value = repaired.value;
    if (isAuthoringDocument(value)) return { status: "blocked", authoring: true, notices: repaired.notices, error: { code: "no-document" } };
    for (const path of unknownKeyPaths(value, schema)) {
        let parent = value as Record<string | number, unknown>;
        for (const key of path.slice(0, -1)) parent = parent[key] as Record<string | number, unknown>;
        delete parent[path.at(-1)!];
        notices.add("skipped", "unknown-field-skipped", path, { field: String(path.at(-1)) });
    }
    const walk = (item: unknown, path: PathSegment[]): unknown => {
        if (typeof item === "string") {
            const node = schemaAt(schema, path);
            if (node?.type === "array" && schemaAt(schema, [...path, 0])?.type === "string") {
                const list = item.split(/[,;\n]+/).map(part => part.trim()).filter(Boolean);
                notices.add("adjusted", "list-split", path, { count: String(list.length) });
                return list;
            }
            const rule = STORED_FIELD_RULES.find(rule => rule.path.test(formatPath(path)));
            if (rule) {
                const result = rule.normalise(item);
                if (result.issue) notices.addIssue(result.issue, path);
                else if (result.value !== item) notices.add("adjusted", "value-coerced", path);
                return result.value;
            }
        }
        if (Array.isArray(item)) return item.map((child, i) => walk(child, [...path, i]));
        if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, walk(child, [...path, key])]));
        return item;
    };
    try {
        const cleaned = walk(value, []);
        return { status: "ok", text: notices.items.length ? JSON.stringify(cleaned, null, 2) : text, notices: notices.items };
    } catch {
        return { status: "blocked", notices: notices.items, error: { code: "invalid-json" } };
    }
}
