import { getPreviewSectionBaseId, resolvePreviewFlowOrder } from "./preview/pagination";
import { getVisibleContentKeys, getVisibleSectionEntries, visibleEntries } from "./preview/visibility";
import type {
    Award,
    Certificate,
    Course,
    CustomSection,
    Declaration,
    Education,
    Experience,
    Interest,
    Language,
    Organisation,
    Project,
    Publication,
    Reference,
    Resume,
    SkillGroup,
} from "./schema";

/**
 * Single source of truth for WHICH content sections render and in WHAT order.
 *
 * The preview and every structured export (Markdown, DOCX) resolve
 * ordering and visibility here, so no exporter can drift from what the user
 * sees. Visibility comes from `preview/visibility`; ordering comes from the
 * same `resolvePreviewFlowOrder` the preview lays its pages out with.
 */

interface SectionEntries<T extends string, E> {
    key: string;
    base: string;
    type: T;
    entries: E[];
}

export type OrderedResumeSection =
    | SectionEntries<"experience", Experience>
    | SectionEntries<"education", Education>
    | SectionEntries<"courses", Course>
    | SectionEntries<"certificates", Certificate>
    | SectionEntries<"awards", Award>
    | SectionEntries<"publications", Publication>
    | SectionEntries<"references", Reference>
    | SectionEntries<"declaration", Declaration>
    | SectionEntries<"projects", Project>
    | SectionEntries<"organisations", Organisation>
    | SectionEntries<"interests", Interest>
    | SectionEntries<"languages", Language>
    | { key: string; base: string; type: "skills"; groups: SkillGroup[] }
    | { key: string; base: string; type: "custom"; custom: CustomSection };

export type OrderedResumeSectionType = OrderedResumeSection["type"];

export interface SectionKeyResolver {
    /**
     * Legacy documents (no configured `contentSections`) render every populated
     * section; once sections are configured, only visible keys render.
     */
    shouldRender: (base: string) => boolean;
    /** The configured key for a base (e.g. "experience:2"), or the base itself. */
    keyFor: (base: string) => string;
    /** Visible `custom:<id>` keys, in configured order. */
    customKeys: Set<string>;
}

export function getSectionKeyResolver(resume: Resume): SectionKeyResolver {
    const visibleKeys = getVisibleContentKeys(resume);
    const hasConfiguredSections = (resume.settings?.contentSections ?? []).length > 0;
    const configuredKeys: Record<string, string> = {};
    const configuredBases = new Set<string>();
    const customKeys = new Set<string>();

    for (const key of visibleKeys) {
        const base = getPreviewSectionBaseId(key);
        configuredBases.add(base);
        if (!configuredKeys[base]) configuredKeys[base] = key;
        if (base === "custom") customKeys.add(key);
    }

    return {
        shouldRender: (base) => !hasConfiguredSections || configuredBases.has(base),
        keyFor: (base) => configuredKeys[base] || base,
        customKeys,
    };
}

/** True when a custom section would render nothing at all in its layout mode. */
export function isCustomSectionEmpty(custom: CustomSection): boolean {
    if (custom.layout === "text") return !custom.text.trim();
    if (custom.layout === "tags") return (custom.tags ?? []).every((tag) => !tag.trim());
    return visibleEntries(custom.entries ?? []).length === 0;
}

export function getOrderedVisibleSections(resume: Resume): OrderedResumeSection[] {
    const { shouldRender, keyFor, customKeys } = getSectionKeyResolver(resume);
    const content = getVisibleSectionEntries(resume);
    const sections: OrderedResumeSection[] = [];

    const pushEntries = <T extends OrderedResumeSection["type"], E>(type: T, entries: E[]) => {
        if (!shouldRender(type) || entries.length === 0) return;
        sections.push({ key: keyFor(type), base: type, type, entries } as OrderedResumeSection);
    };

    // Canonical build order; `resolvePreviewFlowOrder` below applies the user's
    // configured order and appends anything the order does not mention.
    pushEntries("experience", content.experience);
    pushEntries("education", content.education);
    pushEntries("courses", content.courses);
    pushEntries("certificates", content.certificates);
    pushEntries("awards", content.awards);
    pushEntries("publications", content.publications);
    pushEntries("references", content.references);
    pushEntries("declaration", content.declaration);
    pushEntries("projects", content.projects);
    pushEntries("organisations", content.organisations);
    pushEntries("interests", content.interests);
    pushEntries("languages", content.languages);

    const skillGroups = content.skillGroups.filter((group) => group.skills.length > 0);
    if (shouldRender("skills") && skillGroups.length > 0) {
        sections.push({ key: keyFor("skills"), base: "skills", type: "skills", groups: skillGroups });
    }

    // Custom sections key on the full `custom:<id>` as their base so multiple
    // instances never collide in the flow resolver's by-base map.
    for (const custom of resume.customSections ?? []) {
        const key = `custom:${custom.id}`;
        if (!customKeys.has(key) || isCustomSectionEmpty(custom)) continue;
        sections.push({ key, base: key, type: "custom", custom });
    }

    return resolvePreviewFlowOrder(resume.settings?.layout?.sectionOrder ?? [], sections)
        .flatMap((item) => (item.kind === "section" && item.section ? [item.section] : []));
}
