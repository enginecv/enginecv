import { CEFR_LEVELS } from "@/lib/cefr";
import { isNativeLanguageFluency, SKILL_LEVELS, type SkillLevel } from "@/lib/schema";
import { issue, type Issue } from "./notices";

/**
 * Parsers for the human-friendly values AIs write: dates, language levels,
 * skills with a level in brackets, links without a scheme. Pure functions;
 * each returns the stored value and, when the value was not taken verbatim,
 * one issue for the caller to place.
 */

export interface Parsed<T> {
    value: T;
    issue?: Issue;
}

/** Lowercase, no diacritics, single spaces, straight apostrophes. */
export function fold(text: string): string {
    return text
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[‘’ʼ`]/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** How an ongoing end date is stored. */
export const STORED_PRESENT = "Present";
/** How an ongoing end date is written in the format. */
export const AUTHORING_PRESENT = "present";

/** "Ongoing" in the five UI languages, folded. */
export const PRESENT_WORDS: readonly string[] = [
    // en
    "present", "current", "currently", "now", "ongoing", "today", "to date", "to present",
    // de
    "heute", "bis heute", "aktuell", "derzeit", "laufend", "jetzt",
    // bs
    "danas", "do danas", "trenutno", "sada", "u toku",
    // fr
    "aujourd'hui", "a ce jour", "actuel", "actuellement", "en cours", "present",
    // es
    "actualidad", "la actualidad", "presente", "actual", "actualmente", "hoy", "en curso",
];

const PRESENT_SET = new Set(PRESENT_WORDS.map(fold));

/** Month names and abbreviations in en/de/bs/fr/es, folded, mapped to 1–12. */
export const MONTH_NAMES: ReadonlyArray<readonly string[]> = [
    ["january", "jan", "januar", "janner", "janvier", "janv", "enero", "ene"],
    ["february", "feb", "februar", "fevrier", "fevr", "fev", "febrero"],
    ["march", "mar", "marz", "maerz", "mrz", "mart", "mars", "marzo"],
    ["april", "apr", "avril", "avr", "abril", "abr"],
    ["may", "mai", "maj", "mayo"],
    ["june", "jun", "juni", "juin", "junio"],
    ["july", "jul", "juli", "juillet", "juil", "julio"],
    ["august", "aug", "aout", "agosto", "ago"],
    ["september", "sep", "sept", "septembar", "septembre", "septiembre", "setiembre"],
    ["october", "oct", "oktober", "okt", "oktobar", "octobre", "octubre"],
    ["november", "nov", "novembar", "novembre", "noviembre"],
    ["december", "dec", "dezember", "dez", "decembar", "decembre", "diciembre", "dic"],
];

export const MONTH_LOOKUP: ReadonlyMap<string, number> = new Map(
    MONTH_NAMES.flatMap((names, index) => names.map((name) => [name, index + 1] as const)),
);

function pad2(value: number): string {
    return String(value).padStart(2, "0");
}

function isMonth(value: number): boolean {
    return Number.isInteger(value) && value >= 1 && value <= 12;
}

function normalisedDate(value: string, raw: string): Parsed<string> {
    return { value, issue: issue("adjusted", "date-normalised", { value: raw, result: value }) };
}

/**
 * Accepts "YYYY", "YYYY-MM", "YYYY-MM-DD" and "present" as given; "MM/YYYY",
 * "MM.YYYY", "YYYY/MM", "March 2021" (in five languages) and other "present"
 * words are normalised. Anything else is dropped, never guessed.
 */
export function parseHumanDate(raw: string): Parsed<string> {
    const text = raw.trim();
    if (!text) return { value: "" };

    if (/^\d{4}$/.test(text)) return { value: text };
    const ym = /^(\d{4})-(\d{2})$/.exec(text);
    if (ym && isMonth(Number(ym[2]))) return { value: text };
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (ymd && isMonth(Number(ymd[2])) && Number(ymd[3]) >= 1 && Number(ymd[3]) <= 31) {
        return { value: text };
    }

    const folded = fold(text);
    if (folded === AUTHORING_PRESENT) return { value: STORED_PRESENT };
    if (PRESENT_SET.has(folded)) return normalisedDate(STORED_PRESENT, text);

    const monthFirst = /^(\d{1,2})\s*[/.-]\s*(\d{4})$/.exec(text);
    if (monthFirst && isMonth(Number(monthFirst[1]))) {
        return normalisedDate(`${monthFirst[2]}-${pad2(Number(monthFirst[1]))}`, text);
    }
    const yearFirst = /^(\d{4})\s*[/.]\s*(\d{1,2})$/.exec(text);
    if (yearFirst && isMonth(Number(yearFirst[2]))) {
        return normalisedDate(`${yearFirst[1]}-${pad2(Number(yearFirst[2]))}`, text);
    }
    const ymSingle = /^(\d{4})-(\d)$/.exec(text);
    if (ymSingle && isMonth(Number(ymSingle[2]))) {
        return normalisedDate(`${ymSingle[1]}-0${ymSingle[2]}`, text);
    }

    const named = /^([\p{L}'.]+)\.?,?\s+(\d{4})$/u.exec(folded);
    if (named) {
        const month = MONTH_LOOKUP.get(named[1].replace(/\.$/, ""));
        if (month) return normalisedDate(`${named[2]}-${pad2(month)}`, text);
    }

    return { value: "", issue: issue("skipped", "date-unparsed", { value: text }) };
}

/** Stored date → format date; `undefined` means "leave the field out". */
export function formatHumanDate(stored: string | undefined): string | undefined {
    if (!stored) return undefined;
    return stored === STORED_PRESENT ? AUTHORING_PRESENT : stored;
}

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------

/** How a mother tongue is stored (see isNativeLanguageFluency). */
export const STORED_NATIVE = "Native";

const NATIVE_WORDS = new Set([
    "native", "native speaker", "mother tongue", "first language",
    "muttersprache", "muttersprachlich", "erstsprache",
    "maternji", "maternji jezik", "materinji", "materinji jezik", "izvorni govornik",
    "langue maternelle", "natif", "native", "maternelle",
    "lengua materna", "nativo", "nativa", "idioma nativo",
].map(fold));

/**
 * CEFR codes become upper case, "native" words in five languages become
 * "Native"; any other text is kept as written and flagged for review.
 */
export function parseLanguageLevel(raw: string): Parsed<string> {
    const text = raw.trim();
    if (!text) return { value: "" };

    const upper = text.toUpperCase();
    if ((CEFR_LEVELS as readonly string[]).includes(upper)) {
        return upper === text
            ? { value: text }
            : { value: upper, issue: issue("adjusted", "language-normalised", { value: text, result: upper }) };
    }

    if (isNativeLanguageFluency(text)) return { value: text === "native" ? STORED_NATIVE : text };
    if (NATIVE_WORDS.has(fold(text))) {
        return {
            value: STORED_NATIVE,
            issue: issue("adjusted", "language-normalised", { value: text, result: STORED_NATIVE }),
        };
    }

    return { value: text, issue: issue("review", "language-level-unrecognised", { value: text }) };
}

export interface ParsedLanguage {
    language: string;
    fluency: string;
}

/**
 * "German: B2" is the canonical form. "German (C1)" and "German – native"
 * are understood too, with a notice.
 */
export function parseLanguageString(raw: string): Parsed<ParsedLanguage> {
    const text = raw.trim();

    let language = text;
    let level = "";
    let reshaped = false;

    const colon = text.indexOf(":");
    const bracket = /^(.+?)\s*\(([^()]+)\)$/.exec(text);
    const dash = /^(.+?)\s+[-–—]\s+(.+)$/.exec(text);
    if (colon > 0) {
        language = text.slice(0, colon).trim();
        level = text.slice(colon + 1).trim();
    } else if (bracket) {
        [, language, level] = bracket;
        reshaped = true;
    } else if (dash) {
        [, language, level] = dash;
        reshaped = true;
    }

    const parsedLevel = parseLanguageLevel(level);
    const value = { language: language.trim(), fluency: parsedLevel.value };
    if (reshaped) {
        return {
            value,
            issue: issue("adjusted", "language-normalised", {
                value: text,
                result: value.fluency ? `${value.language}: ${value.fluency}` : value.language,
            }),
        };
    }
    return { value, issue: parsedLevel.issue };
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

const SKILL_LEVEL_SYNONYMS: Record<SkillLevel, readonly string[]> = {
    beginner: [
        "beginner", "basic", "basics", "novice", "anfanger", "grundkenntnisse",
        "pocetnik", "osnovno", "osnovni", "debutant", "notions", "principiante", "basico",
    ],
    amateur: ["amateur", "elementary", "elementar", "amater", "aficionado"],
    competent: [
        "competent", "intermediate", "kompetent", "gut", "srednje", "srednji",
        "intermediaire", "intermedio", "competente",
    ],
    proficient: [
        "proficient", "advanced", "fortgeschritten", "sehr gut", "napredno", "napredni",
        "avance", "confirme", "avanzado",
    ],
    expert: ["expert", "experte", "ekspert", "strucnjak", "experto", "master"],
};

const SKILL_LEVEL_LOOKUP: ReadonlyMap<string, SkillLevel> = new Map(
    (Object.entries(SKILL_LEVEL_SYNONYMS) as [SkillLevel, readonly string[]][])
        .flatMap(([level, words]) => words.map((word) => [fold(word), level] as const)),
);

function lookupSkillLevel(raw: string): SkillLevel | undefined {
    return SKILL_LEVEL_LOOKUP.get(fold(raw));
}

/** One of SKILL_LEVELS, a synonym of one (normalised), or dropped. */
export function normaliseSkillLevel(raw: string): Parsed<string> {
    const text = raw.trim();
    if (!text) return { value: "" };
    if ((SKILL_LEVELS as readonly string[]).includes(text)) return { value: text };
    const level = lookupSkillLevel(text);
    if (level) return { value: level, issue: issue("adjusted", "skill-normalised", { value: text, result: level }) };
    return { value: "", issue: issue("skipped", "skill-level-unknown", { value: text }) };
}

export interface ParsedSkill {
    name: string;
    level: string;
}

/**
 * "TypeScript (expert)" splits into name and level when the bracket holds a
 * known level; anything else in brackets stays part of the name.
 */
export function parseSkillString(raw: string): Parsed<ParsedSkill> {
    const text = raw.trim();
    const bracket = /^(.+?)\s*\(([^()]+)\)$/.exec(text);
    if (bracket) {
        const level = (SKILL_LEVELS as readonly string[]).includes(bracket[2].trim())
            ? (bracket[2].trim() as SkillLevel)
            : lookupSkillLevel(bracket[2]);
        if (level) {
            const value = { name: bracket[1].trim(), level };
            return { value, issue: issue("adjusted", "skill-normalised", { value: text, result: `${value.name}: ${level}` }) };
        }
    }
    return { value: { name: text, level: "" } };
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const BARE_DOMAIN = /^(?:www\.)?[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+(?::\d+)?(?:[/?#]\S*)?$/u;

/** "github.com/x" → "https://github.com/x"; anything with a scheme, or not a domain, is kept. */
export function normaliseLink(raw: string): Parsed<string> {
    const text = raw.trim();
    if (!text || HAS_SCHEME.test(text)) return { value: text };
    const candidate = text.startsWith("//") ? text.slice(2) : text;
    if (!candidate.includes("@") && BARE_DOMAIN.test(candidate)) {
        const value = `https://${candidate}`;
        return { value, issue: issue("adjusted", "link-normalised", { value: text, result: value }) };
    }
    return { value: text };
}
