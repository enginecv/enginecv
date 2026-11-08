/**
 * Common European Framework of Reference for Languages (CEFR) building blocks
 * shared by the language editor, the resume grid layout, exports and imports.
 */

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const CEFR_SKILLS = ["listening", "reading", "spokenInteraction", "spokenProduction", "writing"] as const;
export type CefrSkill = (typeof CEFR_SKILLS)[number];

/** Per-skill self-assessment; "" means the skill was not assessed. */
export type CefrSkillLevels = Record<CefrSkill, string>;

export type CefrSkillGroup = "understanding" | "speaking" | "writing";

/** The grouping Europass and the CEFR self-assessment grid present. */
export const CEFR_SKILL_GROUPS: ReadonlyArray<{ group: CefrSkillGroup; skills: readonly CefrSkill[] }> = [
    { group: "understanding", skills: ["listening", "reading"] },
    { group: "speaking", skills: ["spokenInteraction", "spokenProduction"] },
    { group: "writing", skills: ["writing"] },
];

export function emptyCefrSkillLevels(): CefrSkillLevels {
    return { listening: "", reading: "", spokenInteraction: "", spokenProduction: "", writing: "" };
}

export function isCefrLevel(value: string): value is CefrLevel {
    return (CEFR_LEVELS as readonly string[]).includes(value);
}

/** A1–A2 basic, B1–B2 independent, C1–C2 proficient user. */
export function cefrBand(level: CefrLevel): "basic" | "independent" | "proficient" {
    return level.startsWith("A") ? "basic" : level.startsWith("B") ? "independent" : "proficient";
}

export function assessedCefrSkills(levels: Partial<CefrSkillLevels> | undefined): CefrSkill[] {
    return CEFR_SKILLS.filter((skill) => isCefrLevel(levels?.[skill] ?? ""));
}

/**
 * One level standing in for the whole grid: the median of the assessed
 * skills (the lower middle for an even count, so it never overstates).
 * Returns "" when no skill is assessed.
 */
export function deriveOverallCefrLevel(levels: Partial<CefrSkillLevels> | undefined): CefrLevel | "" {
    const sorted = assessedCefrSkills(levels)
        .map((skill) => levels![skill] as CefrLevel)
        .sort((a, b) => CEFR_LEVELS.indexOf(a) - CEFR_LEVELS.indexOf(b));
    return sorted.length > 0 ? sorted[Math.floor((sorted.length - 1) / 2)] : "";
}

/** True when every assessed skill shares one level. */
export function hasUniformCefrLevels(levels: Partial<CefrSkillLevels> | undefined): boolean {
    return new Set(assessedCefrSkills(levels).map((skill) => levels![skill])).size <= 1;
}
