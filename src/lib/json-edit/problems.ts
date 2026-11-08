import type { z } from "zod";
import { formatPath, type PathSegment } from "@/lib/agent/authoring/notices";
import { rangeForPath } from "./locate";

export type ProblemCode = "syntax" | "not-object" | "empty" | "too-large" | "invalid-type" | "invalid-value" | "invalid-enum" | "unknown-key" | "duplicate-id" | "protected-field" | "authoring-format";
export interface Problem {
    from: number; to: number; line: number; column: number; path: string;
    severity: "error" | "warning"; code: ProblemCode; params: Record<string, string>;
}

export function problemAt(text: string, code: ProblemCode, path: readonly PathSegment[] = [], params: Record<string, string> = {}, offset?: number): Problem {
    const range = offset === undefined ? rangeForPath(text, path) : { from: offset, to: Math.min(offset + 1, text.length) };
    const from = range?.from ?? 0;
    const before = text.slice(0, from);
    return { from, to: range?.to ?? text.length, line: before.split("\n").length, column: from - before.lastIndexOf("\n"), path: formatPath(path), severity: "error", code, params };
}

export function zodIssueToProblem(issue: z.core.$ZodIssue): { code: ProblemCode; path: PathSegment[]; params: Record<string, string> } {
    const path = issue.path.filter((part): part is PathSegment => typeof part === "string" || typeof part === "number");
    if (issue.code === "invalid_type") return { code: "invalid-type", path, params: { expected: issue.expected } };
    if (issue.code === "invalid_value") return { code: "invalid-enum", path, params: { expected: issue.values.map(v => JSON.stringify(v)).join(" | ") } };
    if (issue.code === "unrecognized_keys") return { code: "unknown-key", path: [...path, issue.keys[0]], params: {} };
    if (issue.code === "invalid_union") {
        const nested = issue.errors.flat().find(error => error.code !== "invalid_value");
        if (nested) return zodIssueToProblem(nested);
    }
    return { code: "invalid-value", path, params: {} };
}
