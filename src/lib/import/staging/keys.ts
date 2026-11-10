import { allSkills, type Resume } from "@/lib/schema";
import type { StageSection, StagedEntry } from "./types";

const LEGAL_SUFFIXES = new Set(["inc", "incorporated", "ltd", "limited", "llc", "gmbh", "ag", "corp", "corporation", "co", "plc", "sa", "bv", "oy", "ab", "srl", "doo", "dd", "the"]);

/** Lowercase, drop accents, punctuation and legal suffixes, collapse spaces. */
export function normaliseText(value: unknown): string {
    if (typeof value !== "string") return "";
    const plain = value
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/d\.o\.o\./g, "doo")
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9+#\s]/g, " ");
    return plain
        .split(/\s+/)
        .filter((word) => word && !LEGAL_SUFFIXES.has(word))
        .join(" ");
}

/** First four-digit year in a date text, or "". */
export function yearOf(value: unknown): string {
    if (typeof value !== "string") return "";
    return /\b(19|20)\d{2}\b/.exec(value)?.[0] ?? "";
}

function tokens(text: string): string[] {
    return text.split(" ").filter(Boolean);
}

/**
 * Share of the shorter text's words found in the longer one. 1 means one
 * contains the other. Used for near matches such as "Acme" and "Acme Systems".
 */
export function containment(a: string, b: string): number {
    const left = tokens(a);
    const right = tokens(b);
    if (left.length === 0 || right.length === 0) return 0;
    const [short, long] = left.length <= right.length ? [left, right] : [right, left];
    const set = new Set(long);
    return short.filter((word) => set.has(word)).length / short.length;
}

/** Two texts name the same thing: equal once normalised, or one contains the other. */
export function similar(a: unknown, b: unknown, threshold = 1): boolean {
    const left = normaliseText(a);
    const right = normaliseText(b);
    if (!left || !right) return false;
    if (left === right) return true;
    return containment(left, right) >= threshold;
}

interface KeyFields {
    primary: string;
    secondary?: string;
    date?: string;
}

const KEY_FIELDS: Record<StageSection, KeyFields> = {
    experience: { primary: "company", secondary: "position", date: "start" },
    education: { primary: "institution", secondary: "area", date: "start" },
    projects: { primary: "name", date: "start" },
    skills: { primary: "name" },
    organisations: { primary: "name", secondary: "role", date: "start" },
    certificates: { primary: "name", secondary: "issuer", date: "date" },
    awards: { primary: "name", secondary: "issuer", date: "date" },
    publications: { primary: "name", secondary: "publisher", date: "date" },
    languages: { primary: "language" },
    courses: { primary: "name", secondary: "institution" },
    references: { primary: "name", secondary: "organisation" },
    interests: { primary: "name" },
};

/** A stable text key for an entry: the same item gives the same key. */
export function matchKey(section: StageSection, entry: StagedEntry): string {
    const fields = KEY_FIELDS[section];
    const parts = [normaliseText(entry[fields.primary])];
    if (fields.secondary) parts.push(normaliseText(entry[fields.secondary]));
    if (fields.date) parts.push(yearOf(entry[fields.date]));
    return parts.join("|");
}

/** Short text to show for an entry. */
export function entryTitle(section: StageSection, entry: StagedEntry): string {
    const fields = KEY_FIELDS[section];
    const first = String(entry[fields.primary] ?? "").trim();
    const second = fields.secondary ? String(entry[fields.secondary] ?? "").trim() : "";
    return [first, second].filter(Boolean).join(" · ") || "—";
}

/** An entry with nothing in its identifying field: not worth listing. */
export function isEmptyEntry(section: StageSection, entry: StagedEntry): boolean {
    return !String(entry[KEY_FIELDS[section].primary] ?? "").trim();
}

/** Has a name but nothing else worth keeping. */
export function isThinEntry(section: StageSection, entry: StagedEntry): boolean {
    if (section === "skills" || section === "languages" || section === "interests") return false;
    const skip = new Set(["id", "hidden", "urlIcon", KEY_FIELDS[section].primary]);
    return !Object.entries(entry).some(([key, value]) => {
        if (skip.has(key)) return false;
        if (Array.isArray(value)) return value.length > 0;
        return typeof value === "string" && value.trim() !== "";
    });
}

/**
 * Do two entries of one section describe the same item? The identifying names
 * must match (or one contain the other); a missing second field or date never
 * makes two entries different, but two different years do.
 */
export function sameItem(section: StageSection, a: StagedEntry, b: StagedEntry): boolean {
    const fields = KEY_FIELDS[section];
    // Short names must match exactly: "React" and "React Native" are different skills.
    const exactOnly = section === "skills" || section === "languages" || section === "interests";
    const left = normaliseText(a[fields.primary]);
    const right = normaliseText(b[fields.primary]);
    if (!left || !right) return false;
    if (exactOnly ? left !== right : !similar(left, right, 0.8)) return false;
    if (fields.secondary) {
        const second = normaliseText(a[fields.secondary]);
        const otherSecond = normaliseText(b[fields.secondary]);
        if (second && otherSecond && !similar(second, otherSecond, 0.8)) return false;
    }
    if (fields.date) {
        const year = yearOf(a[fields.date]);
        const otherYear = yearOf(b[fields.date]);
        if (year && otherYear && year !== otherYear) return false;
    }
    return true;
}

/** The entries of one section in a CV. Skills are read across every group. */
export function entriesOf(resume: Resume, section: StageSection): StagedEntry[] {
    if (section === "skills") return allSkills(resume.skillGroups) as unknown as StagedEntry[];
    return (resume[section] ?? []) as unknown as StagedEntry[];
}
