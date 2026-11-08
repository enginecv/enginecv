import { createId } from "./id";
import { createUngroupedSkillGroup, type Resume } from "./schema";
import { contentSectionBaseId } from "@/components/editor/content-section-registry";

type EntryLike = { id: string; hidden?: boolean };

export function getContentEntry(
    resume: Resume,
    sectionKey: string,
    entryIndex: number,
): EntryLike | null {
    const base = contentSectionBaseId(sectionKey);
    if (base === "skills") {
        const skills = resume.skillGroups.flatMap((group) => group.skills);
        return skills[entryIndex] ?? null;
    }
    if (base === "custom") {
        return resume.customSections
            .find((section) => `custom:${section.id}` === sectionKey)
            ?.entries[entryIndex] ?? null;
    }

    const entries = getStandardEntries(resume, base);
    return entries?.[entryIndex] ?? null;
}

function getStandardEntries(resume: Resume, base: string): EntryLike[] | null {
    switch (base) {
        case "experience": return resume.experience;
        case "education": return resume.education;
        case "courses": return resume.courses;
        case "projects": return resume.projects;
        case "organisations": return resume.organisations;
        case "certificates": return resume.certificates;
        case "awards": return resume.awards;
        case "publications": return resume.publications;
        case "references": return resume.references;
        case "declaration": return resume.declaration;
        case "languages": return resume.languages;
        case "interests": return resume.interests;
        default: return null;
    }
}

function updateStandardEntries(
    resume: Resume,
    base: string,
    update: (entries: EntryLike[]) => EntryLike[],
): Resume {
    switch (base) {
        case "experience": return { ...resume, experience: update(resume.experience) as Resume["experience"] };
        case "education": return { ...resume, education: update(resume.education) as Resume["education"] };
        case "courses": return { ...resume, courses: update(resume.courses) as Resume["courses"] };
        case "projects": return { ...resume, projects: update(resume.projects) as Resume["projects"] };
        case "organisations": return { ...resume, organisations: update(resume.organisations) as Resume["organisations"] };
        case "certificates": return { ...resume, certificates: update(resume.certificates) as Resume["certificates"] };
        case "awards": return { ...resume, awards: update(resume.awards) as Resume["awards"] };
        case "publications": return { ...resume, publications: update(resume.publications) as Resume["publications"] };
        case "references": return { ...resume, references: update(resume.references) as Resume["references"] };
        case "declaration": return { ...resume, declaration: update(resume.declaration) as Resume["declaration"] };
        case "languages": return { ...resume, languages: update(resume.languages) as Resume["languages"] };
        case "interests": return { ...resume, interests: update(resume.interests) as Resume["interests"] };
        default: return resume;
    }
}

function updateContentEntry(
    resume: Resume,
    sectionKey: string,
    entryIndex: number,
    update: (entry: EntryLike) => EntryLike | null,
): Resume {
    const base = contentSectionBaseId(sectionKey);
    if (base === "skills") {
        let currentIndex = 0;
        return {
            ...resume,
            skillGroups: resume.skillGroups.map((group) => ({
                ...group,
                skills: group.skills.flatMap((skill) => {
                    const matches = currentIndex === entryIndex;
                    currentIndex += 1;
                    if (!matches) return [skill];
                    const next = update(skill);
                    return next ? [next as typeof skill] : [];
                }),
            })),
        };
    }
    if (base === "custom") {
        return {
            ...resume,
            customSections: resume.customSections.map((section) => {
                if (`custom:${section.id}` !== sectionKey) return section;
                return {
                    ...section,
                    entries: section.entries.flatMap((entry, index) => {
                        if (index !== entryIndex) return [entry];
                        const next = update(entry);
                        return next ? [next as typeof entry] : [];
                    }),
                };
            }),
        };
    }

    return updateStandardEntries(resume, base, (entries) => entries.flatMap((entry, index) => {
        if (index !== entryIndex) return [entry];
        const next = update(entry);
        return next ? [next] : [];
    }));
}

export function toggleContentSectionHidden(resume: Resume, sectionKey: string): Resume {
    const hiddenSections = resume.settings.hiddenSections ?? [];
    const nextHidden = hiddenSections.includes(sectionKey)
        ? hiddenSections.filter((key) => key !== sectionKey)
        : [...hiddenSections, sectionKey];
    return {
        ...resume,
        settings: {
            ...resume.settings,
            hiddenSections: nextHidden,
        },
    };
}

export function removeContentSection(resume: Resume, sectionKey: string): Resume {
    const base = contentSectionBaseId(sectionKey);
    const contentSections = (resume.settings.contentSections ?? []).filter((key) => key !== sectionKey);
    const removingLastOfBase = !contentSections.some((key) => contentSectionBaseId(key) === base);
    const sectionOrder = (resume.settings.layout.sectionOrder ?? []).filter(
        (key) => key !== sectionKey && (!removingLastOfBase || key !== base),
    );
    const sectionPlacement = { ...(resume.settings.layout.sectionPlacement ?? {}) };
    delete sectionPlacement[sectionKey];
    if (removingLastOfBase) delete sectionPlacement[base];

    let next: Resume = {
        ...resume,
        settings: {
            ...resume.settings,
            contentSections,
            hiddenSections: (resume.settings.hiddenSections ?? []).filter((key) => key !== sectionKey),
            layout: {
                ...resume.settings.layout,
                sectionOrder,
                sectionPlacement,
            },
        },
    };

    if (base === "custom") {
        next = {
            ...next,
            customSections: next.customSections.filter((section) => `custom:${section.id}` !== sectionKey),
        };
    }
    if (!removingLastOfBase) return next;

    switch (base) {
        case "experience": return { ...next, experience: [] };
        case "education": return { ...next, education: [] };
        case "courses": return { ...next, courses: [] };
        case "projects": return { ...next, projects: [] };
        case "organisations": return { ...next, organisations: [] };
        case "certificates": return { ...next, certificates: [] };
        case "awards": return { ...next, awards: [] };
        case "publications": return { ...next, publications: [] };
        case "references": return { ...next, references: [] };
        case "declaration": return { ...next, declaration: [] };
        case "languages": return { ...next, languages: [] };
        case "interests": return { ...next, interests: [] };
        case "skills": return { ...next, skillGroups: [createUngroupedSkillGroup()] };
        default: return next;
    }
}

export function toggleContentEntryHidden(
    resume: Resume,
    sectionKey: string,
    entryIndex: number,
): Resume {
    return updateContentEntry(resume, sectionKey, entryIndex, (entry) => ({
        ...entry,
        hidden: !entry.hidden,
    }));
}

export function duplicateContentEntry(
    resume: Resume,
    sectionKey: string,
    entryIndex: number,
): Resume {
    const source = getContentEntry(resume, sectionKey, entryIndex);
    if (!source) return resume;
    const duplicate = { ...structuredClone(source), id: createId() };
    const base = contentSectionBaseId(sectionKey);

    if (base === "skills") {
        let currentIndex = 0;
        return {
            ...resume,
            skillGroups: resume.skillGroups.map((group) => ({
                ...group,
                skills: group.skills.flatMap((skill) => {
                    const matches = currentIndex === entryIndex;
                    currentIndex += 1;
                    return matches ? [skill, duplicate as typeof skill] : [skill];
                }),
            })),
        };
    }
    if (base === "custom") {
        return {
            ...resume,
            customSections: resume.customSections.map((section) => {
                if (`custom:${section.id}` !== sectionKey) return section;
                return {
                    ...section,
                    entries: section.entries.flatMap((entry, index) => (
                        index === entryIndex ? [entry, duplicate as typeof entry] : [entry]
                    )),
                };
            }),
        };
    }
    return updateStandardEntries(resume, base, (entries) => entries.flatMap((entry, index) => (
        index === entryIndex ? [entry, duplicate] : [entry]
    )));
}

export function removeContentEntry(
    resume: Resume,
    sectionKey: string,
    entryIndex: number,
): Resume {
    return updateContentEntry(resume, sectionKey, entryIndex, () => null);
}
