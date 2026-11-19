import type { Resume } from "@/lib/schema";

/**
 * Puts the content of a file onto the CV that is open: what the file owns is
 * replaced, what the app owns (design, id, meta, photo, signature) is kept.
 * Pure; the sync engine and its tests share it.
 */

type Obj = Record<string, unknown>;

const ENTRY_SECTIONS = [
    "experience",
    "education",
    "courses",
    "projects",
    "organisations",
    "certificates",
    "awards",
    "publications",
    "references",
    "declaration",
    "languages",
    "interests",
] as const;

export interface ContentChange {
    added: number;
    removed: number;
    changed: number;
}

export function applyContent(current: Resume, incoming: Resume): Resume {
    const next: Resume = {
        ...current,
        basics: {
            ...incoming.basics,
            photo: current.basics.photo,
            photoEdit: current.basics.photoEdit,
        },
        skillGroups: incoming.skillGroups,
        customSections: incoming.customSections.map((section) => {
            const existing = current.customSections.find((candidate) => candidate.id === section.id);
            return existing ? { ...section, icon: existing.icon } : section;
        }),
        settings: {
            ...current.settings,
            contentSections: incoming.settings.contentSections,
            layout: { ...current.settings.layout, sectionOrder: incoming.settings.layout.sectionOrder },
        },
    };
    for (const key of ENTRY_SECTIONS) {
        (next as unknown as Obj)[key] = incoming[key];
    }
    // The signature is drawn in the app and has no place in the file.
    next.declaration = incoming.declaration.map((entry) => {
        const existing = current.declaration.find((candidate) => candidate.id === entry.id);
        return existing && !entry.signature ? { ...entry, signature: existing.signature } : entry;
    });
    return next;
}

function entriesOf(resume: Resume): Map<string, string> {
    const map = new Map<string, string>();
    for (const key of ENTRY_SECTIONS) {
        for (const entry of resume[key] as Array<{ id: string }>) map.set(`${key}:${entry.id}`, JSON.stringify(entry));
    }
    for (const group of resume.skillGroups) {
        for (const skill of group.skills) map.set(`skills:${skill.id}`, JSON.stringify({ ...skill, group: group.name }));
    }
    for (const section of resume.customSections) map.set(`custom:${section.id}`, JSON.stringify(section));
    return map;
}

export function describeContentChange(before: Resume, after: Resume): ContentChange {
    const a = entriesOf(before);
    const b = entriesOf(after);
    let added = 0;
    let removed = 0;
    let changed = 0;
    for (const [key, value] of b) {
        const old = a.get(key);
        if (old === undefined) added += 1;
        else if (old !== value) changed += 1;
    }
    for (const key of a.keys()) if (!b.has(key)) removed += 1;
    // The header block and the summary have no entries; a difference counts once each.
    const { photo: _p1, photoEdit: _e1, summary: s1, ...basicsBefore } = before.basics;
    const { photo: _p2, photoEdit: _e2, summary: s2, ...basicsAfter } = after.basics;
    void _p1; void _e1; void _p2; void _e2;
    if (JSON.stringify(basicsBefore) !== JSON.stringify(basicsAfter)) changed += 1;
    if (s1 !== s2) changed += 1;
    return { added, removed, changed };
}

/** Entries the shrink guard counts: every entry of every section, every skill and every custom entry. */
export function countEntries(resume: Resume): number {
    return entriesOf(resume).size;
}
