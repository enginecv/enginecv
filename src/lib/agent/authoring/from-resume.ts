import { CEFR_SKILLS } from "@/lib/cefr";
import { createEmptyResume, UNGROUPED_SKILL_GROUP_ID, type Resume } from "@/lib/schema";
import {
    AUTHORING_FORMAT,
    AUTHORING_SECTION_KEYS,
    BASICS_FIELDS,
    LIST_SECTION_KEYS,
    SECTION_ENTRY_SPECS,
    SENSITIVE_BASICS_FIELDS,
    type AuthoringDocument,
    type AuthoringSectionKey,
    type EntrySpec,
} from "./schema";
import { formatHumanDate } from "./values";

export interface ResumeToAuthoringOptions {
    /** Write entry ids, so a later import can match entries (Copy for AI, agents). */
    ids?: boolean;
    /** Include date of birth, ID numbers and the other sensitive details (research R7). */
    personal?: boolean;
}

type Obj = Record<string, unknown>;

// Primitives, not the settings object: schema defaults are shared objects, so a
// caller mutating one resume's defaults must not move what counts as default here.
const DEFAULT_ACCENT = createEmptyResume().settings.colors.accent;
const DEFAULT_CV_LANGUAGE = createEmptyResume().settings.language;

function nonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value !== "";
}

/**
 * Writes one stored entry through its spec: empty values, `hidden: false`
 * and defaults are left out; ids only when asked for.
 */
function entryOut(stored: Obj, spec: EntrySpec, options: ResumeToAuthoringOptions): Obj {
    const out: Obj = {};
    for (const [name, field] of Object.entries(spec.fields)) {
        const value = stored[name];
        switch (field.kind) {
            case "id":
                if (options.ids && nonEmptyString(value)) out.id = value;
                break;
            case "hidden":
                if (value === true) out.hidden = true;
                break;
            case "date": {
                const date = formatHumanDate(value as string | undefined);
                if (date) out[name] = date;
                break;
            }
            case "list":
            case "highlights":
                if (Array.isArray(value) && value.length > 0) out[name] = [...value];
                break;
            case "repos":
                if (Array.isArray(value) && value.length > 0) out[name] = value.map(repoOut);
                break;
            default:
                if (nonEmptyString(value)) out[name] = value;
        }
    }
    return out;
}

function repoOut(repo: Obj): unknown {
    const label = nonEmptyString(repo.label) ? repo.label : undefined;
    const platform = nonEmptyString(repo.platform) && repo.platform !== "auto" ? repo.platform : undefined;
    if (!label && !platform) return repo.url;
    return { url: repo.url, ...(label ? { label } : {}), ...(platform ? { platform } : {}) };
}

function basicsOut(basics: Resume["basics"], options: ResumeToAuthoringOptions): Obj | undefined {
    const out: Obj = {};
    for (const name of Object.keys(BASICS_FIELDS) as (keyof typeof BASICS_FIELDS)[]) {
        if (!options.personal && SENSITIVE_BASICS_FIELDS.includes(name)) continue;
        if (name === "email") {
            const emails = basics.emails.filter((entry) => entry.email);
            if (emails.length === 1 && !emails[0].label) out.email = emails[0].email;
            else if (emails.length > 0) {
                out.email = emails.map((entry) => entry.label ? { email: entry.email, label: entry.label } : entry.email);
            } else if (basics.email) out.email = basics.email;
            continue;
        }
        if (name === "links") {
            const links = basics.customLinks
                .filter((link) => link.url || link.name)
                .map((link) => ({
                    ...(link.name ? { name: link.name } : {}),
                    url: link.url,
                    ...(link.label ? { label: link.label } : {}),
                }));
            if (links.length > 0) out.links = links;
            continue;
        }
        const value = basics[name];
        if (nonEmptyString(value)) out[name] = value;
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

type StoredSkill = Resume["skillGroups"][number]["skills"][number];

function skillOut(skill: StoredSkill, options: ResumeToAuthoringOptions): unknown {
    const plain = !skill.level && !skill.description && skill.keywords.length === 0 && !skill.hidden;
    return plain ? skill.name : entryOut(skill as unknown as Obj, SECTION_ENTRY_SPECS.skill, options);
}

function skillsOut(groups: Resume["skillGroups"], options: ResumeToAuthoringOptions): unknown {
    const ungrouped = groups.find((group) => group.id === UNGROUPED_SKILL_GROUP_ID);
    const named = groups.filter((group) => group.id !== UNGROUPED_SKILL_GROUP_ID);
    const loose = (ungrouped?.skills ?? []).map((skill) => skillOut(skill, options));

    if (named.length === 0) return loose.length > 0 ? loose : undefined;

    const names = named.map((group) => group.name);
    const needsList = named.some((group) => group.hidden || !group.name.trim())
        || new Set(names).size !== names.length;
    if (needsList) {
        return [
            ...loose,
            ...named.map((group) => ({
                group: group.name,
                skills: group.skills.map((skill) => skillOut(skill, options)),
                ...(group.hidden ? { hidden: true } : {}),
            })),
        ];
    }

    const out: Record<string, unknown[]> = {};
    if (loose.length > 0) out[""] = loose;
    for (const group of named) out[group.name] = group.skills.map((skill) => skillOut(skill, options));
    return out;
}

type StoredLanguage = Resume["languages"][number];

function languageOut(language: StoredLanguage, options: ResumeToAuthoringOptions): unknown {
    const ambiguousName = language.language.includes(":")
        || /\(.*\)\s*$/.test(language.language)
        || /\s[-–—]\s/.test(language.language);
    const plain = !language.hidden
        && !language.cefrDetailed
        && language.assessmentType === "none"
        && !language.description
        && language.language !== ""
        && !ambiguousName;
    if (plain) return language.fluency ? `${language.language}: ${language.fluency}` : language.language;

    const out: Obj = {};
    if (options.ids) out.id = language.id;
    out.language = language.language;
    if (language.fluency) out.level = language.fluency;
    if (language.cefrDetailed) {
        const cefr: Obj = {};
        for (const skill of CEFR_SKILLS) if (language.cefr[skill]) cefr[skill] = language.cefr[skill];
        out.cefr = cefr;
    }
    if (language.assessmentType === "issuer") {
        out.certificate = {
            ...(language.issuer ? { issuer: language.issuer } : {}),
            ...(language.assessmentId ? { id: language.assessmentId } : {}),
            ...(language.assessmentUrl ? { url: language.assessmentUrl } : {}),
        };
    } else if (language.assessmentType === "self") {
        out.selfAssessed = true;
    }
    if (language.description) out.description = language.description;
    if (language.hidden) out.hidden = true;
    return out;
}

function interestOut(interest: Resume["interests"][number], options: ResumeToAuthoringOptions): unknown {
    return !interest.description && !interest.hidden && interest.name
        ? interest.name
        : entryOut(interest as unknown as Obj, SECTION_ENTRY_SPECS.interests, options);
}

function customOut(section: Resume["customSections"][number], options: ResumeToAuthoringOptions): Obj {
    const out: Obj = {};
    if (options.ids) out.id = section.id;
    out.title = section.title;
    if (section.layout === "entries") {
        out.entries = section.entries.map((entry) =>
            entryOut(entry as unknown as Obj, SECTION_ENTRY_SPECS.customEntry, options));
    } else if (section.layout === "tags") {
        out.tags = [...section.tags];
    } else if (section.text) {
        out.text = section.text;
    }
    if (section.hidden) out.hidden = true;
    return out;
}

/** Sections in the CV's own order first, then the rest in canonical order. */
function sectionOrder(resume: Resume): AuthoringSectionKey[] {
    const order: AuthoringSectionKey[] = [];
    const add = (key: string) => {
        const section = (key.startsWith("custom:") ? "custom" : key) as AuthoringSectionKey;
        if ((AUTHORING_SECTION_KEYS as readonly string[]).includes(section) && !order.includes(section)) {
            order.push(section);
        }
    };
    resume.settings.layout.sectionOrder.forEach(add);
    resume.settings.contentSections.forEach(add);
    AUTHORING_SECTION_KEYS.forEach(add);
    return order;
}

/**
 * The one conversion from a stored CV to an authoring document: the compact
 * read view behind Copy for AI and, later, the agent tools.
 */
export function resumeToAuthoring(resume: Resume, options: ResumeToAuthoringOptions = {}): AuthoringDocument {
    const doc: Obj = { format: AUTHORING_FORMAT };

    const design: Obj = {};
    if (resume.settings.colors.accent !== DEFAULT_ACCENT) design.accent = resume.settings.colors.accent;
    if (resume.settings.language !== DEFAULT_CV_LANGUAGE) design.cvLanguage = resume.settings.language;
    if (Object.keys(design).length > 0) doc.design = design;

    const basics = basicsOut(resume.basics, options);
    if (basics) doc.basics = basics;
    if (resume.basics.summary) doc.summary = resume.basics.summary;

    for (const section of sectionOrder(resume)) {
        let value: unknown;
        if ((LIST_SECTION_KEYS as readonly string[]).includes(section)) {
            const spec = SECTION_ENTRY_SPECS[section as (typeof LIST_SECTION_KEYS)[number]];
            const entries = resume[section as (typeof LIST_SECTION_KEYS)[number]] as unknown as Obj[];
            if (entries.length > 0) value = entries.map((entry) => entryOut(entry, spec, options));
        } else if (section === "declaration") {
            const entries = resume.declaration.map((entry) =>
                entryOut(entry as unknown as Obj, SECTION_ENTRY_SPECS.declaration, options));
            if (entries.length === 1) value = entries[0];
            else if (entries.length > 1) value = entries;
        } else if (section === "skills") {
            value = skillsOut(resume.skillGroups, options);
        } else if (section === "languages") {
            if (resume.languages.length > 0) value = resume.languages.map((language) => languageOut(language, options));
        } else if (section === "interests") {
            if (resume.interests.length > 0) value = resume.interests.map((interest) => interestOut(interest, options));
        } else if (section === "custom") {
            if (resume.customSections.length > 0) value = resume.customSections.map((custom) => customOut(custom, options));
        }
        if (value !== undefined) doc[section] = value;
    }

    return doc as AuthoringDocument;
}

export function serializeAuthoring(document: AuthoringDocument, style: "compact" | "pretty"): string {
    return style === "pretty" ? JSON.stringify(document, null, 2) : JSON.stringify(document);
}
