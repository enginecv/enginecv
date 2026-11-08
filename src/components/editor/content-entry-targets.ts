import { allSkills, type Resume } from "@/lib/schema";
import { getContentSectionDefinition } from "./content-section-registry";

export interface ContentEntryTarget {
    id: string;
    sectionKey: string;
    entryIndex: number | null;
    label: string;
    description: string;
    keywords: string[];
    hidden: boolean;
}

type Translate = (key: string, params?: Record<string, string | number>) => string;

const SEARCH_EXCLUDED_KEYS = new Set([
    "id",
    "hidden",
    "photo",
    "photoEdit",
    "signature",
    "detailsOrder",
    "icon",
    "urlIcon",
    "display",
]);

function text(...values: Array<string | undefined | null>): string {
    return values.map((value) => value?.trim()).filter(Boolean).join(" · ");
}

function searchableStrings(value: unknown, key = ""): string[] {
    if (SEARCH_EXCLUDED_KEYS.has(key)) return [];
    if (typeof value === "string") {
        const normalized = value.trim();
        return normalized && !normalized.startsWith("data:") ? [normalized] : [];
    }
    if (Array.isArray(value)) {
        return value.flatMap((item) => searchableStrings(item));
    }
    if (!value || typeof value !== "object") return [];
    return Object.entries(value).flatMap(([childKey, childValue]) => (
        searchableStrings(childValue, childKey)
    ));
}

function uniqueStrings(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function previewText(value: string): string {
    const plain = value
        .replace(/https?:\/\/\S+/g, "")
        .replace(/[#*_`>[\]()~-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return plain.length > 120 ? `${plain.slice(0, 117).trimEnd()}...` : plain;
}

export function getContentEntryTargets(
    resume: Resume,
    t: Translate,
): ContentEntryTarget[] {
    const configured = new Set(resume.settings?.contentSections ?? []);
    const targets: ContentEntryTarget[] = [];

    const basicsKeywords = uniqueStrings([
        ...searchableStrings(resume.basics),
        ...searchableStrings(resume.meta),
    ]);
    if (basicsKeywords.length > 0) {
        const basicsDefinition = getContentSectionDefinition("basics");
        targets.push({
            id: "basics",
            sectionKey: "basics",
            entryIndex: null,
            label: resume.basics.name.trim()
                || (basicsDefinition ? t(basicsDefinition.labelKey) : "basics"),
            description: text(resume.basics.headline, resume.basics.location)
                || previewText(resume.basics.summary),
            keywords: uniqueStrings([
                basicsDefinition ? t(basicsDefinition.labelKey) : "basics",
                ...basicsKeywords,
            ]),
            hidden: false,
        });
    }

    const add = <T extends { id: string; hidden?: boolean }>(
        sectionKey: string,
        entries: T[],
        getLabel: (entry: T) => string,
        getDescription: (entry: T) => string,
        exact = true,
        getAdditionalKeywords: (entry: T) => string[] = () => [],
    ) => {
        if (!configured.has(sectionKey)) return;
        const definition = getContentSectionDefinition(sectionKey);
        entries.forEach((entry, index) => {
            const label = getLabel(entry) || t("editor.customEntryUntitled");
            const description = getDescription(entry);
            targets.push({
                id: `${sectionKey}:${entry.id}`,
                sectionKey,
                entryIndex: exact ? index : null,
                label,
                description,
                keywords: uniqueStrings([
                    definition ? t(definition.labelKey) : sectionKey,
                    label,
                    description,
                    ...searchableStrings(entry),
                    ...getAdditionalKeywords(entry),
                ]),
                hidden: entry.hidden === true,
            });
        });
    };

    add("experience", resume.experience, (entry) => text(entry.position, entry.company), (entry) => text(entry.company, entry.location));
    add("education", resume.education, (entry) => text(entry.studyType, entry.area), (entry) => text(entry.institution, entry.location));
    add("courses", resume.courses, (entry) => entry.name, (entry) => text(entry.institution, entry.location));
    add("projects", resume.projects, (entry) => entry.name, (entry) => entry.subtitle);
    add("organisations", resume.organisations, (entry) => entry.name, (entry) => entry.role);
    add("certificates", resume.certificates, (entry) => entry.name, (entry) => entry.issuer);
    add("awards", resume.awards, (entry) => entry.name, (entry) => entry.issuer);
    add("publications", resume.publications, (entry) => entry.name, (entry) => entry.publisher);
    add("references", resume.references, (entry) => entry.name, (entry) => text(entry.position, entry.organisation));
    add("declaration", resume.declaration, (entry) => entry.fullName, (entry) => text(entry.place, entry.date), false);
    add("languages", resume.languages, (entry) => entry.language, (entry) => text(entry.fluency, entry.issuer));
    add("interests", resume.interests, (entry) => entry.name, (entry) => entry.description);
    const skillGroupByEntryId = new Map(
        resume.skillGroups.flatMap((group) => (
            group.skills.map((skill) => [skill.id, group.name] as const)
        )),
    );
    add(
        "skills",
        allSkills(resume.skillGroups),
        (entry) => entry.name,
        (entry) => entry.description,
        false,
        (entry) => [skillGroupByEntryId.get(entry.id) ?? ""],
    );

    for (const section of resume.customSections) {
        const sectionKey = `custom:${section.id}`;
        add(sectionKey, section.entries, (entry) => entry.title, (entry) => text(entry.subtitle, entry.location));

        if (!configured.has(sectionKey) || section.layout === "entries") continue;
        const body = section.layout === "text" ? section.text : section.tags.join(" · ");
        if (!body.trim()) continue;
        targets.push({
            id: sectionKey,
            sectionKey,
            entryIndex: null,
            label: section.title.trim() || t("editor.sectionCustom"),
            description: previewText(body),
            keywords: uniqueStrings([
                section.title,
                sectionKey,
                ...searchableStrings(section.layout === "text" ? section.text : section.tags),
            ]),
            hidden: section.hidden,
        });
    }

    return targets;
}
