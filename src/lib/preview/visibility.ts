import { allSkills, type Resume, type SkillGroup } from "@/lib/schema";

/**
 * Single source of truth for what the preview (and therefore every visual
 * export, which consumes the preview's page chunks) is allowed to render.
 * JSON export/backup reads the raw document and never goes through here.
 */

interface HideableEntry {
    hidden?: boolean;
}

const ENTRY_ARRAYS = [
    "experience",
    "education",
    "courses",
    "certificates",
    "awards",
    "publications",
    "references",
    "declaration",
    "projects",
    "languages",
    "organisations",
    "interests",
] as const;

type EntryArrayName = (typeof ENTRY_ARRAYS)[number];

function sectionBaseKey(sectionKey: string): string {
    return sectionKey.split(":")[0];
}

export function isSectionHidden(resume: Resume, sectionKey: string): boolean {
    return (resume.settings?.hiddenSections ?? []).includes(sectionKey);
}

/** Order-preserving filter of entries flagged hidden. */
export function visibleEntries<T extends HideableEntry>(entries: T[]): T[] {
    return entries.filter((entry) => entry.hidden !== true);
}

function entriesForBase(resume: Resume, base: string): HideableEntry[] | null {
    if (base === "skills") {
        // A skill counts as visible only when neither it nor its group is hidden.
        return (resume.skillGroups ?? []).flatMap((group) =>
            group.skills.map((skill) => ({ hidden: group.hidden === true || skill.hidden === true })),
        );
    }
    if ((ENTRY_ARRAYS as readonly string[]).includes(base)) {
        return (resume[base as EntryArrayName] ?? []) as HideableEntry[];
    }
    return null;
}

/** Groups with hidden groups dropped and hidden skills filtered out. */
export function visibleSkillGroups(groups: SkillGroup[]): SkillGroup[] {
    return groups
        .filter((group) => group.hidden !== true)
        .map((group) => ({ ...group, skills: visibleEntries(group.skills) }));
}

/**
 * All content arrays with hidden entries filtered out — the only
 * entry data the preview block builders may consume.
 */
export function getVisibleSectionEntries(resume: Resume) {
    return {
        experience: visibleEntries(resume.experience ?? []),
        education: visibleEntries(resume.education ?? []),
        courses: visibleEntries(resume.courses ?? []),
        certificates: visibleEntries(resume.certificates ?? []),
        awards: visibleEntries(resume.awards ?? []),
        publications: visibleEntries(resume.publications ?? []),
        references: visibleEntries(resume.references ?? []),
        declaration: visibleEntries(resume.declaration ?? []),
        projects: visibleEntries(resume.projects ?? []),
        skillGroups: visibleSkillGroups(resume.skillGroups ?? []),
        languages: visibleEntries(resume.languages ?? []),
        organisations: visibleEntries(resume.organisations ?? []),
        interests: visibleEntries(resume.interests ?? []),
    };
}

/**
 * Content-section keys the preview should render: configured keys minus
 * explicitly hidden ones and minus sections with entries but none visible.
 * Section types without a known entry array pass through untouched.
 */
export function getVisibleContentKeys(resume: Resume): string[] {
    const keys = resume.settings?.contentSections ?? [];

    return keys.filter((key) => {
        if (isSectionHidden(resume, key)) return false;

        const entries = entriesForBase(resume, sectionBaseKey(key));
        if (entries === null) return true;
        if (entries.length === 0) return true;
        return visibleEntries(entries).length > 0;
    });
}

function sourceIndicesOf(entries: HideableEntry[]): number[] {
    return entries.flatMap((entry, index) => (entry.hidden === true ? [] : [index]));
}

/**
 * For each entry the preview shows (in order), its position in the full,
 * unfiltered list the editor works with. The preview builds from the visible
 * list, so the index it reports for "go to this entry" must be mapped back,
 * otherwise a hidden entry above shifts every entry below it by one.
 *
 * Skills map the groups the preview shows (not hidden, at least one visible skill)
 * to their position in `skillGroups`. Unknown section
 * types return an empty list (callers fall back to the visible position).
 */
export function getVisibleSourceIndices(resume: Resume, sectionKey: string): number[] {
    const base = sectionBaseKey(sectionKey);
    if (base === "custom") {
        const id = sectionKey.slice("custom:".length);
        const custom = (resume.customSections ?? []).find((section) => section.id === id);
        return sourceIndicesOf((custom?.entries ?? []) as HideableEntry[]);
    }
    if (base === "skills") {
        // The preview shows one entry per group that is not hidden and still has a
        // visible skill, so those are the positions to map back.
        return (resume.skillGroups ?? []).flatMap((group, index) =>
            group.hidden === true || visibleEntries(group.skills).length === 0 ? [] : [index],
        );
    }
    if ((ENTRY_ARRAYS as readonly string[]).includes(base)) {
        return sourceIndicesOf((resume[base as EntryArrayName] ?? []) as HideableEntry[]);
    }
    return [];
}
