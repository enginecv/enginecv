import { allSkills, type Resume } from "@/lib/schema";

/**
 * Tokens a letter body can use. They are written as `{{name}}` in the markdown
 * source; the preview shows their current value as a highlighted chip.
 */
export const LETTER_TOKENS = ["name", "role", "location", "skills"] as const;
export type LetterToken = (typeof LETTER_TOKENS)[number];

/** How many skills the `skills` token lists, in the CV's order. */
export const SKILLS_TOKEN_LIMIT = 5;

const TOKEN_PATTERN = /\{\{\s*([A-Za-z]+)\s*\}\}/g;

/** Wraps a resolved value so the preview can draw it as a chip; exports never see these. */
export const CHIP_START = "";
export const CHIP_END = "";
/** Starts a chip whose token had nothing to show; its text is the token name. */
export const CHIP_UNRESOLVED_START = "\uE002";

export type TokenValues = Record<LetterToken, string>;

export interface FoundToken {
    /** Name as written, lower-cased. */
    name: string;
    known: boolean;
}

export function isLetterToken(name: string): name is LetterToken {
    return (LETTER_TOKENS as readonly string[]).includes(name);
}

/** Every `{{token}}` in a markdown source, in order. */
export function findTokens(markdown: string): FoundToken[] {
    return [...markdown.matchAll(TOKEN_PATTERN)].map((match) => {
        const name = match[1].toLowerCase();
        return { name, known: isLetterToken(name) };
    });
}

/** What each token means for this CV right now. Empty string means "nothing to show". */
export function tokenValues(cv: Pick<Resume, "basics" | "experience" | "skillGroups">): TokenValues {
    const experienceRole = cv.experience.find((entry) => !entry.hidden && entry.position.trim())?.position.trim() ?? "";
    const visibleGroups = cv.skillGroups.filter((group) => !group.hidden);
    const skills = allSkills(visibleGroups)
        .filter((skill) => !skill.hidden && skill.name.trim())
        .slice(0, SKILLS_TOKEN_LIMIT)
        .map((skill) => skill.name.trim());
    return {
        name: cv.basics.name.trim(),
        role: cv.basics.headline.trim() || experienceRole,
        location: cv.basics.location.trim(),
        skills: skills.join(", "),
    };
}

export interface SubstituteOptions {
    /** Wrap values in chip markers for the preview. Exports leave this off. */
    chips?: boolean;
}

export interface SubstituteResult {
    text: string;
    /** Names of tokens that resolved to nothing (empty value or unknown name). */
    unresolved: string[];
}

/** Replaces each `{{token}}` with its value. Unresolved tokens become empty text (or a flagged chip). */
export function substituteTokens(markdown: string, values: Partial<Record<string, string>>, options: SubstituteOptions = {}): SubstituteResult {
    const unresolved: string[] = [];
    const text = markdown.replace(TOKEN_PATTERN, (_whole, raw: string) => {
        const name = raw.toLowerCase();
        const value = values[name] ?? "";
        if (!value) {
            unresolved.push(name);
            return options.chips ? `${CHIP_UNRESOLVED_START}${name}${CHIP_END}` : "";
        }
        return options.chips ? `${CHIP_START}${value}${CHIP_END}` : value;
    });
    return { text, unresolved };
}

/** Removes chip markers (for plain output paths that may receive marked text). */
export function stripChipMarkers(text: string): string {
    return text.split(CHIP_START).join("").split(CHIP_UNRESOLVED_START).join("").split(CHIP_END).join("");
}
