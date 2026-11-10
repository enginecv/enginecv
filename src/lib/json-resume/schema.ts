/**
 * JSON Resume v1.0.0 (https://jsonresume.org/schema) as far as EngineCV reads
 * and writes it. Import is lenient (it reads `unknown` field by field and skips
 * what it cannot use); export builds the typed shape below.
 */

/** Largest file the importer reads. A photo embedded as data can make a file large. */
export const MAX_JSON_RESUME_BYTES = 2 * 1024 * 1024;

export const JSON_RESUME_VERSION = "v1.0.0";

/** Top-level keys the schema defines. Anything else is counted as ignored. */
export const JSON_RESUME_KEYS = [
    "$schema",
    "basics",
    "work",
    "volunteer",
    "education",
    "awards",
    "certificates",
    "publications",
    "skills",
    "languages",
    "interests",
    "references",
    "projects",
    "meta",
] as const;

export interface JsonResumeProfile {
    network?: string;
    username?: string;
    url?: string;
}

export interface JsonResumeLocation {
    address?: string;
    postalCode?: string;
    city?: string;
    region?: string;
    countryCode?: string;
}

export interface JsonResumeBasics {
    name?: string;
    label?: string;
    image?: string;
    email?: string;
    phone?: string;
    url?: string;
    summary?: string;
    location?: JsonResumeLocation;
    profiles?: JsonResumeProfile[];
}

export type JsonResumeEntry = Record<string, string | string[] | undefined>;

export interface JsonResumeSkill {
    name?: string;
    level?: string;
    keywords?: string[];
}

export interface JsonResumeDocument {
    $schema?: string;
    basics?: JsonResumeBasics;
    work?: JsonResumeEntry[];
    volunteer?: JsonResumeEntry[];
    education?: JsonResumeEntry[];
    awards?: JsonResumeEntry[];
    certificates?: JsonResumeEntry[];
    publications?: JsonResumeEntry[];
    skills?: JsonResumeSkill[];
    languages?: { language?: string; fluency?: string }[];
    interests?: { name?: string; keywords?: string[] }[];
    references?: { name?: string; reference?: string }[];
    projects?: JsonResumeEntry[];
    meta?: { canonical?: string; version?: string; lastModified?: string; theme?: string };
}
