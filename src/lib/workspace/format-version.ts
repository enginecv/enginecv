import type { DocReason } from "./types";

/**
 * Versions of the files the workspace writes. The same rule everywhere: check `format` first; a file
 * from the same major version is read (unknown keys ignored with a notice by the codec); a newer
 * major version is read-only with reason `newer-version`; anything else is not a workspace file.
 * A migration table exists from v1 so the first real change has somewhere to go.
 */

export const LETTER_FORMAT = "enginecv.letter/v1";
export const WORKSPACE_FORMAT = "enginecv.workspace/v1";
export const INDEX_FORMAT = "enginecv.index/v1";

export interface ParsedFormat {
    family: string;
    major: number;
}

/** `"enginecv.letter/v2"` becomes `{ family: "enginecv.letter", major: 2 }`. */
export function parseFormat(value: unknown): ParsedFormat | null {
    if (typeof value !== "string") return null;
    const match = /^([a-z][a-z0-9.-]*)\/v(\d+)(?:\.\d+)?$/i.exec(value.trim());
    return match ? { family: match[1].toLowerCase(), major: Number(match[2]) } : null;
}

export type FormatCheck =
    | { ok: true; major: number; migrate: boolean }
    | { ok: false; reason: DocReason };

/**
 * `expected` is the family and the newest major this app understands. A missing format is accepted as
 * the current version (agents often leave it out); a wrong family is not this kind of file.
 */
export function checkFormat(found: unknown, expected: ParsedFormat): FormatCheck {
    if (found === undefined || found === null || found === "") return { ok: true, major: expected.major, migrate: false };
    const parsed = parseFormat(found);
    if (!parsed || parsed.family !== expected.family) return { ok: false, reason: { code: "no-document", detail: "format" } };
    if (parsed.major > expected.major) return { ok: false, reason: { code: "newer-version", detail: `v${parsed.major}` } };
    return { ok: true, major: parsed.major, migrate: parsed.major < expected.major };
}

type Migration = (document: Record<string, unknown>) => Record<string, unknown>;

/** `MIGRATIONS[family][n]` upgrades a document from major `n + 1` to `n + 2`. Empty while v1 is the only version. */
export const MIGRATIONS: Record<string, Migration[]> = {};

export function migrate(document: Record<string, unknown>, family: string, from: number, to: number): Record<string, unknown> {
    let current = document;
    for (let major = from; major < to; major += 1) {
        const step = MIGRATIONS[family]?.[major - 1];
        if (step) current = step(current);
    }
    return current;
}
