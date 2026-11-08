/**
 * Options for the GitHub profile README export.
 *
 * Everything resets each time the dialog opens except `credit`, the opt-in
 * "Built with EngineCV" line, which is remembered on this device.
 */

export type ReadmeSkillStyle = "badges" | "text";

export type ReadmeSectionToggle = "headline" | "location" | "summary" | "skills" | "experience" | "projects" | "links";

export interface ReadmeOptions {
    sections: Record<ReadmeSectionToggle, boolean>;
    maxRoles: number;
    maxProjects: number;
    maxSkills: number;
    skillStyle: ReadmeSkillStyle;
    /** Email and phone. Off by default: a profile README is public. */
    includeContact: boolean;
    /** Theme-aware `<picture>` card snippet at the top. */
    includeCard: boolean;
    includeFullCv: boolean;
    fullCvFile: string;
    credit: boolean;
}

export const README_SECTION_TOGGLES: readonly ReadmeSectionToggle[] = [
    "headline", "location", "summary", "skills", "experience", "projects", "links",
];

export const README_LIMITS = {
    maxRoles: { min: 1, max: 10, fallback: 3 },
    maxProjects: { min: 0, max: 10, fallback: 3 },
    maxSkills: { min: 1, max: 50, fallback: 15 },
} as const;

export const DEFAULT_FULL_CV_FILE = "cv.pdf";

const FULL_CV_FILE = /^[\w.-]{1,64}\.pdf$/i;

const CREDIT_STORAGE_KEY = "enginecv-readme-credit";

export function defaultReadmeOptions(credit = false): ReadmeOptions {
    return {
        sections: Object.fromEntries(README_SECTION_TOGGLES.map((key) => [key, true])) as Record<ReadmeSectionToggle, boolean>,
        maxRoles: README_LIMITS.maxRoles.fallback,
        maxProjects: README_LIMITS.maxProjects.fallback,
        maxSkills: README_LIMITS.maxSkills.fallback,
        skillStyle: "badges",
        includeContact: false,
        includeCard: true,
        includeFullCv: false,
        fullCvFile: DEFAULT_FULL_CV_FILE,
        credit,
    };
}

function clamp(value: number, limit: { min: number; max: number; fallback: number }): number {
    if (!Number.isFinite(value)) return limit.fallback;
    return Math.min(limit.max, Math.max(limit.min, Math.round(value)));
}

/** A file name that can sit next to README.md; anything else falls back to `cv.pdf`. */
export function normalizeFullCvFile(value: string): string {
    const trimmed = value.trim();
    return FULL_CV_FILE.test(trimmed) ? trimmed : DEFAULT_FULL_CV_FILE;
}

export function normalizeReadmeOptions(options: ReadmeOptions): ReadmeOptions {
    return {
        ...options,
        maxRoles: clamp(options.maxRoles, README_LIMITS.maxRoles),
        maxProjects: clamp(options.maxProjects, README_LIMITS.maxProjects),
        maxSkills: clamp(options.maxSkills, README_LIMITS.maxSkills),
        fullCvFile: normalizeFullCvFile(options.fullCvFile),
    };
}

export function loadReadmeCredit(): boolean {
    try {
        return localStorage.getItem(CREDIT_STORAGE_KEY) === "1";
    } catch {
        return false;
    }
}

export function saveReadmeCredit(on: boolean): void {
    try {
        localStorage.setItem(CREDIT_STORAGE_KEY, on ? "1" : "0");
    } catch {
        // Private mode or blocked storage: the choice just isn't remembered.
    }
}
