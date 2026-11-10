import { CURRENT, type StageSection, type StagedBatch } from "@/lib/import/staging/types";

/** Translation keys for the section names. */
export const SECTION_LABEL_KEYS: Record<StageSection, string> = {
    experience: "editor.sectionExperience",
    education: "editor.sectionEducation",
    projects: "editor.sectionProjects",
    skills: "editor.sectionSkills",
    organisations: "editor.sectionOrganisations",
    certificates: "editor.sectionCertificates",
    awards: "editor.sectionAwards",
    publications: "editor.sectionPublications",
    languages: "editor.sectionLanguages",
    courses: "editor.sectionCourses",
    references: "editor.sectionReferences",
    interests: "editor.sectionInterests",
};

const KNOWN_FIELDS = new Set([
    "name", "headline", "email", "phone", "location", "website", "linkedin", "github", "summary", "photo",
    "company", "position", "start", "end", "date", "description", "highlights", "institution", "area",
    "studyType", "role", "issuer", "publisher", "fluency", "level", "url",
]);

/** Translation key for a field name; fields without their own label share one. */
export function fieldLabelKey(field: string): string {
    return KNOWN_FIELDS.has(field) ? `importHub.field.${field}` : "importHub.field.other";
}

/** Text for a choice's source: the CV itself, or the source's file name. */
export function optionLabel(optionId: string, batches: StagedBatch[], t: (key: string) => string): string {
    if (optionId === CURRENT) return t("importHub.currentValue");
    return batches.find((batch) => batch.id === optionId)?.label ?? optionId;
}

/** A value cut to a readable length for a choice list. */
export function shorten(value: string, max = 160): string {
    const flat = value.replace(/\s*\n\s*/g, " / ");
    return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}
