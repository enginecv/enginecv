import { inlineToPlainText, parseMarkdownBlocks } from "@/lib/markdown-inline";
import { titleFields } from "@/lib/import/staging/keys";
import { CURRENT, NONE, type StageSection, type StagedBatch, type StagedEntry } from "@/lib/import/staging/types";

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
    if (optionId === NONE) return t("importHub.none");
    return batches.find((batch) => batch.id === optionId)?.label ?? optionId;
}

/** A value cut to a readable length for a choice list. */
export function shorten(value: string, max = 160): string {
    const flat = value.replace(/\s*\n\s*/g, " / ");
    return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

/** Short facts shown under an entry's title, in this order, when the title does not already say them. */
const META_FIELDS = ["position", "studyType", "subtitle", "role", "issuer", "publisher", "institution", "organisation", "fluency", "location"];

export interface EntryDetails {
    /** Dates first, then the short facts and the link. */
    meta: string[];
    /** The description as plain text, or the highlights when there is none. */
    text: string;
    /** Keywords and skills, without repeats. */
    tags: string[];
}

const textOf = (entry: StagedEntry, key: string): string => (typeof entry[key] === "string" ? (entry[key] as string).trim() : "");
const listOf = (entry: StagedEntry, key: string): string[] =>
    Array.isArray(entry[key]) ? (entry[key] as unknown[]).filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];

function plainText(markdown: string): string {
    return parseMarkdownBlocks(markdown)
        .flatMap((block) => (block.type === "paragraph" ? [block.content] : block.items))
        .map((tokens) => inlineToPlainText(tokens).trim())
        .filter(Boolean)
        .join(" ");
}

/** A link without its scheme, "www." or trailing slash. */
function linkLabel(url: string): string {
    return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
}

/** What an entry holds beyond its title, for the review list. `formatDate` turns a stored date into display text. */
export function entryDetails(section: StageSection, entry: StagedEntry, formatDate: (value: string) => string): EntryDetails {
    const inTitle = new Set(titleFields(section));
    const dates = [textOf(entry, "start") || textOf(entry, "date"), textOf(entry, "end")].filter(Boolean).map(formatDate).join(" – ");
    const facts = META_FIELDS.filter((field) => !inTitle.has(field)).map((field) => textOf(entry, field));
    const meta = [dates, ...facts, linkLabel(textOf(entry, "url"))].filter(Boolean);
    const summary = plainText(textOf(entry, "description")) || listOf(entry, "highlights").map(plainText).join(" · ");
    // "typescript" (a topic) and "TypeScript" (a language) are one tag; the first spelling wins.
    const seen = new Set<string>();
    const tags = [...listOf(entry, "keywords"), ...listOf(entry, "skills")].filter((tag) => !seen.has(tag.toLowerCase()) && seen.add(tag.toLowerCase()));
    return { meta, text: shorten(summary, 240), tags };
}
