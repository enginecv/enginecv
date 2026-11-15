import {
    DEFAULT_SKILLS_SECTION,
    SKILL_LEVELS,
    SKILL_LEVEL_STYLES,
    type Resume,
    type SkillLevel,
    type SkillsSection,
} from "@/lib/schema";

/**
 * Level names as they appear in the CV (the "text" style and the text exports).
 * They follow the CV language, never the app language. Order matches SKILL_LEVELS.
 */
const SKILL_LEVEL_WORDS: Record<string, readonly [string, string, string, string, string]> = {
    en: ["Beginner", "Amateur", "Competent", "Proficient", "Expert"],
    bs: ["Početnik", "Amater", "Kompetentan", "Vješt", "Stručnjak"],
    hr: ["Početnik", "Amater", "Kompetentan", "Vješt", "Stručnjak"],
    sr: ["Početnik", "Amater", "Kompetentan", "Vešt", "Stručnjak"],
    de: ["Anfänger", "Amateur", "Kompetent", "Versiert", "Experte"],
    es: ["Principiante", "Aficionado", "Competente", "Avanzado", "Experto"],
    fr: ["Débutant", "Amateur", "Compétent", "Avancé", "Expert"],
    it: ["Principiante", "Amatore", "Competente", "Avanzato", "Esperto"],
    pt: ["Iniciante", "Amador", "Competente", "Proficiente", "Especialista"],
    nl: ["Beginner", "Amateur", "Bekwaam", "Gevorderd", "Expert"],
    pl: ["Początkujący", "Amator", "Kompetentny", "Zaawansowany", "Ekspert"],
    cs: ["Začátečník", "Amatér", "Kompetentní", "Pokročilý", "Expert"],
    sk: ["Začiatočník", "Amatér", "Kompetentný", "Pokročilý", "Expert"],
    sl: ["Začetnik", "Amater", "Kompetenten", "Napreden", "Strokovnjak"],
    ro: ["Începător", "Amator", "Competent", "Avansat", "Expert"],
    hu: ["Kezdő", "Amatőr", "Kompetens", "Haladó", "Szakértő"],
    tr: ["Başlangıç", "Amatör", "Yetkin", "İleri", "Uzman"],
    sq: ["Fillestar", "Amator", "Kompetent", "I avancuar", "Ekspert"],
    fi: ["Aloittelija", "Harrastaja", "Pätevä", "Taitava", "Asiantuntija"],
    sv: ["Nybörjare", "Amatör", "Kompetent", "Avancerad", "Expert"],
    no: ["Nybegynner", "Amatør", "Kompetent", "Avansert", "Ekspert"],
    da: ["Begynder", "Amatør", "Kompetent", "Avanceret", "Ekspert"],
};

/** A stored level that is one of the five known ones, else null (empty, unknown, imported junk). */
export function parseSkillLevel(value: unknown): SkillLevel | null {
    return typeof value === "string" && (SKILL_LEVELS as readonly string[]).includes(value)
        ? (value as SkillLevel)
        : null;
}

/** 1-5 for a known level, 0 for none. */
export function skillLevelNumber(value: unknown): number {
    const level = parseSkillLevel(value);
    return level ? SKILL_LEVELS.indexOf(level) + 1 : 0;
}

/** The level's name in the CV language (English when the language is unknown), or "" for no level. */
export function getSkillLevelWord(value: unknown, language: string): string {
    const level = parseSkillLevel(value);
    if (!level) return "";
    const words = SKILL_LEVEL_WORDS[language] ?? SKILL_LEVEL_WORDS[language.split("-")[0]] ?? SKILL_LEVEL_WORDS.en;
    return words[SKILL_LEVELS.indexOf(level)];
}

/** True when every field equals the default. */
export function isDefaultSkillsSection(section: SkillsSection): boolean {
    return (Object.keys(DEFAULT_SKILLS_SECTION) as (keyof SkillsSection)[])
        .every((key) => section[key] === DEFAULT_SKILLS_SECTION[key]);
}

/**
 * Templates are setting presets: one that leaves the level meter at the default
 * must not reset what the user chose; only one that deliberately changes it
 * (ATS Plain turns it off) is applied.
 */
export function resolveSkillsSectionForTemplate(current: SkillsSection, fromTemplate: SkillsSection): SkillsSection {
    return isDefaultSkillsSection(fromTemplate) ? current : fromTemplate;
}

/** Meter settings in force for a skills section: the CV-wide setting with that section's override on top. */
export function resolveSkillsSection(
    resume: Pick<Resume, "settings" | "customization">,
    sectionKey = "skills",
): SkillsSection {
    const base = {
        ...DEFAULT_SKILLS_SECTION,
        ...((resume.settings as { skillsSection?: Partial<SkillsSection> } | undefined)?.skillsSection ?? {}),
    };
    const overrides = resume.customization?.sectionOverrides ?? {};
    const override = (overrides[sectionKey] ?? overrides[sectionKey.split(":")[0]])?.skillsSection;
    const merged = { ...base, ...(override ?? {}) };
    return {
        showLevels: typeof merged.showLevels === "boolean" ? merged.showLevels : DEFAULT_SKILLS_SECTION.showLevels,
        levelStyle: (SKILL_LEVEL_STYLES as readonly string[]).includes(merged.levelStyle as string)
            ? (merged.levelStyle as SkillsSection["levelStyle"])
            : DEFAULT_SKILLS_SECTION.levelStyle,
    };
}
