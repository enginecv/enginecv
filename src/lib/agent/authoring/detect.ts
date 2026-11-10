import { AUTHORING_FORMAT_PREFIX, AUTHORING_SECTION_KEYS, SECTION_SYNONYMS } from "./schema";

type Obj = Record<string, unknown>;

function isObj(value: unknown): value is Obj {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Keys only the stored resume has, never an authoring document. A file with
 * any of them is an EngineCV file, even a hand-trimmed one with just `meta`
 * and `basics`, and keeps going to the existing JSON import (FR-017).
 */
const STORED_ONLY_KEYS = [
    "settings", "customization", "meta", "skillGroups", "aiHistory", "variants",
    "coverLetters", "jobContext", "createdAt", "updatedAt",
];

/** A full EngineCV export (plain or encrypted): goes to the existing JSON import. */
export function isFullEngineCvExport(json: unknown): boolean {
    if (!isObj(json)) return false;
    if (json.format === "enginecv/encrypted-json") return true;
    if (typeof json.format === "string" && json.format.startsWith(AUTHORING_FORMAT_PREFIX)) return false;
    // A JSON Resume file has a `meta` key too, but it is not an EngineCV file.
    if (isJsonResume(json)) return false;
    return STORED_ONLY_KEYS.some((key) => key in json);
}

/** True for a jsonresume.org document: the JSON Resume importer reads it (feature 080). */
export function isJsonResumeDocument(json: unknown): boolean {
    return isObj(json) && isJsonResume(json);
}

/** jsonresume.org documents look similar but are a different format (#67). */
function isJsonResume(json: Obj): boolean {
    if (typeof json.$schema === "string" && json.$schema.includes("jsonresume")) return true;
    if (isObj(json.meta) && "canonical" in json.meta) return true;
    const basics = json.basics;
    return isObj(basics) && (Array.isArray(basics.profiles) || typeof basics.label === "string");
}

/**
 * True for authoring documents, with or without the `format` marker; false
 * for full EngineCV exports, JSON Resume and other JSON.
 */
export function isAuthoringDocument(json: unknown): boolean {
    if (!isObj(json)) return false;
    if (typeof json.format === "string") return json.format.startsWith(AUTHORING_FORMAT_PREFIX);
    if (isFullEngineCvExport(json) || isJsonResume(json)) return false;
    if (isObj(json.basics)) return true;
    const known = Object.keys(json).filter((key) =>
        (AUTHORING_SECTION_KEYS as readonly string[]).includes(key) || key in SECTION_SYNONYMS);
    return known.length >= 2;
}
