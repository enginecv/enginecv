import { isFullEngineCvExport } from "./detect";
import { NoticeList, type Notice, type NoticeCode } from "./notices";

/**
 * Finds the authoring document in whatever a chat assistant answered (prose,
 * code fences, two documents) and repairs the usual JSON mistakes. Each
 * repair is a `repaired` notice; nothing is guessed (research R3).
 */

export const MAX_AUTHORING_TEXT_BYTES = 200 * 1024;

export type ParseErrorCode = "empty" | "too-large" | "no-document" | "invalid-json";

export interface ParseResult {
    status: "ok" | "blocked" | "full-export";
    document?: unknown;
    notices: Notice[];
    error?: { code: ParseErrorCode; line?: number; column?: number };
}

const FENCE = /```[^\n`]*\n([\s\S]*?)(?:```|$)/g;
const SMART_DOUBLE_QUOTES = new Set(["“", "”", "„", "‟", "″"]);

/** The first balanced `{…}` from `from`, skipping braces inside strings. */
export function findObject(text: string, from = 0): { start: number; end: number } | null {
    const start = text.indexOf("{", from);
    if (start < 0) return null;
    let depth = 0;
    let inString = false;
    for (let i = start; i < text.length; i += 1) {
        const char = text[i];
        if (inString) {
            if (char === "\\") i += 1;
            else if (char === "\"") inString = false;
            continue;
        }
        if (char === "\"") inString = true;
        else if (char === "{") depth += 1;
        else if (char === "}") {
            depth -= 1;
            if (depth === 0) return { start, end: i + 1 };
        }
    }
    // Unbalanced (often a cut-off answer): hand the rest to JSON.parse for a position.
    return { start, end: text.length };
}

/**
 * Walks `text` and lets `outside` rewrite characters that are not inside a
 * straight-quoted string. Returns the new text.
 */
function rewriteOutsideStrings(
    text: string,
    outside: (text: string, index: number, out: string[]) => number,
): string {
    const out: string[] = [];
    let i = 0;
    while (i < text.length) {
        const char = text[i];
        if (char === "\"") {
            out.push(char);
            i += 1;
            while (i < text.length) {
                const inner = text[i];
                out.push(inner);
                i += 1;
                if (inner === "\\" && i < text.length) {
                    out.push(text[i]);
                    i += 1;
                } else if (inner === "\"") {
                    break;
                }
            }
            continue;
        }
        i = outside(text, i, out);
    }
    return out.join("");
}

/** “key”: “value” → "key": "value"; smart quotes inside real strings stay. */
function repairSmartQuotes(text: string): string {
    return rewriteOutsideStrings(text, (source, index, out) => {
        if (!SMART_DOUBLE_QUOTES.has(source[index])) {
            out.push(source[index]);
            return index + 1;
        }
        out.push("\"");
        let i = index + 1;
        while (i < source.length && !SMART_DOUBLE_QUOTES.has(source[i])) {
            const char = source[i];
            if (char === "\\" && i + 1 < source.length) {
                out.push(char, source[i + 1]);
                i += 2;
                continue;
            }
            out.push(char === "\"" ? "\\\"" : char === "\n" ? "\\n" : char);
            i += 1;
        }
        out.push("\"");
        return i + 1;
    });
}

function repairComments(text: string): string {
    return rewriteOutsideStrings(text, (source, index, out) => {
        if (source.startsWith("//", index)) {
            const end = source.indexOf("\n", index);
            return end < 0 ? source.length : end;
        }
        if (source.startsWith("/*", index)) {
            const end = source.indexOf("*/", index + 2);
            return end < 0 ? source.length : end + 2;
        }
        out.push(source[index]);
        return index + 1;
    });
}

function repairTrailingCommas(text: string): string {
    return rewriteOutsideStrings(text, (source, index, out) => {
        if (source[index] === ",") {
            let next = index + 1;
            while (next < source.length && /\s/.test(source[next])) next += 1;
            if (source[next] === "}" || source[next] === "]") return index + 1;
        }
        out.push(source[index]);
        return index + 1;
    });
}

function repairUnquotedKeys(text: string): string {
    return rewriteOutsideStrings(text, (source, index, out) => {
        const match = /^[A-Za-z_$][\w$]*/.exec(source.slice(index, index + 200));
        if (match) {
            let last = out.length - 1;
            while (last >= 0 && !out[last].trim()) last -= 1;
            const before = last >= 0 ? out[last].trimEnd().slice(-1) : "";
            let after = index + match[0].length;
            while (after < source.length && /\s/.test(source[after])) after += 1;
            if ((before === "{" || before === ",") && source[after] === ":") {
                out.push(`"${match[0]}"`);
                return index + match[0].length;
            }
            out.push(match[0]);
            return index + match[0].length;
        }
        out.push(source[index]);
        return index + 1;
    });
}

const REPAIRS: ReadonlyArray<[NoticeCode, (text: string) => string]> = [
    ["smart-quotes", repairSmartQuotes],
    ["comments", repairComments],
    ["trailing-comma", repairTrailingCommas],
    ["unquoted-keys", repairUnquotedKeys],
];

function tryParse(text: string): { ok: true; value: unknown } | { ok: false; error: Error } {
    try {
        return { ok: true, value: JSON.parse(text) };
    } catch (error) {
        return { ok: false, error: error as Error };
    }
}

/** Line and column (1-based) of a JSON.parse error inside `text`. */
export function errorPosition(error: Error, text: string): { line: number; column: number } {
    const lineColumn = /line (\d+) column (\d+)/.exec(error.message);
    if (lineColumn) return { line: Number(lineColumn[1]), column: Number(lineColumn[2]) };
    const position = /position (\d+)/.exec(error.message);
    const offset = position ? Number(position[1]) : text.length;
    const before = text.slice(0, offset);
    const line = before.split("\n").length;
    return { line, column: offset - before.lastIndexOf("\n") };
}

function blocked(code: ParseErrorCode, notices: NoticeList, position?: { line: number; column: number }): RepairResult {
    return { status: "blocked", notices: notices.items, error: { code, ...position } };
}

export type RepairResult =
    | { status: "ok"; value: unknown; text: string; notices: Notice[] }
    | { status: "blocked"; notices: Notice[]; error: { code: ParseErrorCode; line?: number; column?: number } };

/** Shared text repair, without the authoring format checks or size limit. */
export function repairJsonText(input: string, opts: { maxBytes: number }): RepairResult {
    const notices = new NoticeList();
    if (!input.trim()) return blocked("empty", notices);
    if (new TextEncoder().encode(input).length > opts.maxBytes) return blocked("too-large", notices);

    const text = input.replace(/^﻿/, "");

    // 1. A fenced block that holds an object wins over the surrounding prose.
    let scope = text;
    let scopeOffset = 0;
    const fences = [...text.matchAll(FENCE)].filter((match) => match[1].includes("{"));
    if (fences.length > 0) {
        const fence = fences[0];
        scope = fence[1];
        scopeOffset = (fence.index ?? 0) + fence[0].indexOf(fence[1]);
        notices.add("repaired", "code-fence", []);
        const outside = text.slice(0, fence.index) + text.slice((fence.index ?? 0) + fence[0].length);
        if (outside.trim()) notices.add("repaired", "surrounding-text", []);
        if (fences.length > 1) notices.add("repaired", "multiple-documents", []);
    }

    // 2. The first balanced object inside it.
    const found = findObject(scope);
    if (!found) return blocked("no-document", notices);
    const block = scope.slice(found.start, found.end);
    if (fences.length === 0) {
        if (scope.slice(0, found.start).trim() || scope.slice(found.end).trim()) {
            notices.add("repaired", "surrounding-text", []);
        }
        const second = findObject(scope, found.end);
        if (second && second.end - second.start > 2 && scope.slice(second.start, second.end).includes(":")) {
            notices.add("repaired", "multiple-documents", []);
        }
    }

    // 3. Parse, then repair in order and retry.
    let candidate = block;
    let parsed = tryParse(candidate);
    for (const [code, repair] of REPAIRS) {
        if (parsed.ok) break;
        const repaired = repair(candidate);
        if (repaired === candidate) continue;
        candidate = repaired;
        notices.add("repaired", code, []);
        parsed = tryParse(candidate);
    }

    if (!parsed.ok) {
        const inBlock = errorPosition(parsed.error, candidate);
        const linesBefore = text.slice(0, scopeOffset + found.start).split("\n");
        const line = linesBefore.length - 1 + inBlock.line;
        const column = inBlock.line === 1 ? linesBefore[linesBefore.length - 1].length + inBlock.column : inBlock.column;
        return blocked("invalid-json", notices, { line, column });
    }

    return { status: "ok", value: parsed.value, text: candidate, notices: notices.items };
}

export function parseAuthoringText(input: string): ParseResult {
    const repaired = repairJsonText(input, { maxBytes: MAX_AUTHORING_TEXT_BYTES });
    if (repaired.status === "blocked") return repaired;
    const { value: document, notices } = repaired;
    if (typeof document !== "object" || document === null || Array.isArray(document)) {
        return { status: "blocked", notices, error: { code: "no-document" } };
    }
    if (isFullEngineCvExport(document)) {
        return { status: "full-export", document, notices };
    }
    return { status: "ok", document, notices };
}
