/**
 * One table per section, read by both directions so the field mapping is
 * declared once (feature 080). Fields that need more than a copy (skills,
 * languages, highlights folded into text, dates) are handled in code and are
 * named here only so the "left out" check knows about them.
 */

export type EngineSection =
    | "experience"
    | "organisations"
    | "education"
    | "awards"
    | "certificates"
    | "publications"
    | "projects"
    | "references"
    | "interests"
    | "languages";

type Pair = readonly [jsonResume: string, engine: string];

export interface SectionMap {
    /** JSON Resume key. */
    jr: string;
    /** EngineCV section key. */
    engine: EngineSection;
    /** Text fields copied as they are. */
    text: readonly Pair[];
    /** Date fields. */
    dates: readonly Pair[];
    /** String-list fields copied as they are. */
    lists: readonly Pair[];
    /** A start date with no end date means the entry is current. */
    currentWithoutEnd: boolean;
    /** EngineCV fields on this section that JSON Resume has no place for. */
    extras: readonly string[];
}

export const SECTION_MAPS: readonly SectionMap[] = [
    {
        jr: "work",
        engine: "experience",
        text: [["name", "company"], ["position", "position"], ["url", "url"], ["location", "location"], ["summary", "description"]],
        dates: [["startDate", "start"], ["endDate", "end"]],
        lists: [["highlights", "highlights"]],
        currentWithoutEnd: true,
        extras: ["skills"],
    },
    {
        jr: "volunteer",
        engine: "organisations",
        text: [["organization", "name"], ["position", "role"], ["url", "url"], ["summary", "description"]],
        dates: [["startDate", "start"], ["endDate", "end"]],
        lists: [],
        currentWithoutEnd: true,
        extras: ["location", "skills"],
    },
    {
        jr: "education",
        engine: "education",
        text: [["institution", "institution"], ["url", "url"], ["area", "area"], ["studyType", "studyType"], ["score", "score"]],
        dates: [["startDate", "start"], ["endDate", "end"]],
        lists: [["courses", "courses"]],
        currentWithoutEnd: false,
        extras: ["location", "description", "skills"],
    },
    {
        jr: "awards",
        engine: "awards",
        text: [["title", "name"], ["awarder", "issuer"], ["summary", "description"]],
        dates: [["date", "date"]],
        lists: [],
        currentWithoutEnd: false,
        extras: ["skills", "url"],
    },
    {
        jr: "certificates",
        engine: "certificates",
        text: [["name", "name"], ["issuer", "issuer"], ["url", "url"]],
        dates: [["date", "date"]],
        lists: [],
        currentWithoutEnd: false,
        extras: ["description", "skills", "issuerUrl"],
    },
    {
        jr: "publications",
        engine: "publications",
        text: [["name", "name"], ["publisher", "publisher"], ["url", "url"], ["summary", "description"]],
        dates: [["releaseDate", "date"]],
        lists: [],
        currentWithoutEnd: false,
        extras: ["skills"],
    },
    {
        jr: "projects",
        engine: "projects",
        text: [["name", "name"], ["description", "description"], ["url", "url"], ["entity", "subtitle"]],
        dates: [["startDate", "start"], ["endDate", "end"]],
        lists: [["highlights", "highlights"], ["keywords", "keywords"]],
        currentWithoutEnd: false,
        extras: ["skills", "repos", "icon"],
    },
    {
        jr: "references",
        engine: "references",
        text: [["name", "name"], ["reference", "description"]],
        dates: [],
        lists: [],
        currentWithoutEnd: false,
        extras: ["position", "organisation", "email", "phone", "url"],
    },
    {
        jr: "interests",
        engine: "interests",
        text: [["name", "name"]],
        dates: [],
        lists: [],
        currentWithoutEnd: false,
        extras: ["description"],
    },
    {
        jr: "languages",
        engine: "languages",
        text: [["language", "language"], ["fluency", "fluency"]],
        dates: [],
        lists: [],
        currentWithoutEnd: false,
        extras: ["description", "assessmentType", "issuer", "assessmentId", "assessmentUrl"],
    },
];

/** Section order for a new CV built from a JSON Resume file. */
export const IMPORT_SECTION_ORDER = [
    "experience",
    "organisations",
    "education",
    "awards",
    "certificates",
    "publications",
    "skills",
    "languages",
    "interests",
    "references",
    "projects",
] as const;

export function sectionMapFor(engine: EngineSection): SectionMap {
    const map = SECTION_MAPS.find((entry) => entry.engine === engine);
    if (!map) throw new Error(`No JSON Resume mapping for ${engine}`);
    return map;
}
