import { assessedCefrSkills, type CefrSkill, type CefrSkillLevels } from "./cefr";
import { formatCvDate, formatCvText, getCvLanguageLabels } from "./cv-language";
import { getDisabilityLabel, isDisabilityKey, isHiddenDisability } from "./disability";
import { getResumeEmails } from "./emails";
import { getMaritalStatusLabel, isHiddenMaritalStatus, isMaritalStatusKey } from "./marital-status";
import { visibleEntries } from "./preview/visibility";
import { getOrderedVisibleSections, type OrderedResumeSection, type OrderedResumeSectionType } from "./resume-sections";
import { isNativeLanguageFluency, type CustomSection, type Resume } from "./schema";

/**
 * Neutral intermediate representation between the resume document and the
 * structured exporters (Markdown, DOCX).
 *
 * Everything locale- or settings-dependent is already resolved here — dates are
 * formatted strings, headings are final labels, links are validated — so each
 * serializer only decides how to render, never what to render.
 */

export interface DocumentLink {
    url: string;
    label: string;
}

export interface DocumentDetail {
    label: string;
    value: string;
    /** Present when the detail is itself a link target (email, phone, repo). */
    url?: string;
}

export interface DocumentImage {
    /** `data:` URL as stored on the resume — decoded by whichever serializer needs bytes. */
    dataUrl: string;
    /** Image MIME type parsed out of the data URL, e.g. `image/png`. */
    mimeType: string;
    /** Rendered size in px, as configured in the preview's photo settings. */
    width: number;
    height: number;
    /** Alt text; the person's name, since the only image today is the portrait. */
    alt: string;
}

export interface DocumentSkillGroup {
    name: string;
    skills: string[];
}

export interface DocumentEntry {
    id: string;
    title: string;
    subtitle: string;
    /** Link belonging to the entry (rendered on the subtitle, or the title). */
    link: DocumentLink | null;
    /** Already formatted per the resume's date format and language. */
    dateRange: string;
    location: string;
    /** Rich-text body, verbatim Markdown as authored. */
    body: string;
    /** Fallback bullet list used when a body is absent. */
    bullets: string[];
    /** Skill tags attached to the entry. */
    tags: string[];
    /** Secondary labelled facts (GPA, contact details, repositories). */
    details: DocumentDetail[];
}

export interface DocumentSection {
    /** Configured content-section key, e.g. "experience" or "custom:<id>". */
    key: string;
    /**
     * Section kind the key derives from. Layout settings are stored against
     * either, so both are needed to resolve a section's column placement.
     */
    base: string;
    type: OrderedResumeSectionType;
    heading: string;
    entries: DocumentEntry[];
    skillGroups: DocumentSkillGroup[];
    /** Markdown body of a custom section using the "text" layout. */
    text: string;
    /** Tags of a custom section using the "tags" layout. */
    tags: string[];
}

export interface DocumentModel {
    language: string;
    dateFormat: string;
    basics: {
        name: string;
        headline: string;
        summary: string;
        summaryHeading: string;
        emails: DocumentDetail[];
        phone: string;
        location: string;
        links: DocumentLink[];
        details: DocumentDetail[];
        photo: DocumentImage | null;
    };
    sections: DocumentSection[];
}

/** Only real, resolvable targets become links; everything else is dropped. */
export function toDocumentLink(url: string | undefined, label: string): DocumentLink | null {
    const trimmed = (url ?? "").trim();
    if (!trimmed) return null;

    if (/^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed)) {
        return { url: trimmed, label: label || trimmed };
    }

    const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
        const parsed = new URL(href);
        if (!parsed.hostname.includes(".")) return null;
        return { url: href, label: label || trimmed };
    } catch {
        return null;
    }
}

function emptyEntry(id: string): DocumentEntry {
    return {
        id,
        title: "",
        subtitle: "",
        link: null,
        dateRange: "",
        location: "",
        body: "",
        bullets: [],
        tags: [],
        details: [],
    };
}

function emptySection(key: string, base: string, type: OrderedResumeSectionType, heading: string): DocumentSection {
    return { key, base, type, heading, entries: [], skillGroups: [], text: "", tags: [] };
}

function cleanList(values: readonly string[] | undefined): string[] {
    return (values ?? []).map((value) => value.trim()).filter(Boolean);
}

/**
 * Nothing here reads the app locale. Every label in a rendered document comes
 * from the CV language, so switching the editor's own language cannot change
 * what the document says.
 */
export function toDocumentModel(resume: Resume): DocumentModel {
    const settings = resume.settings;
    const language = settings?.language ?? "en";
    const dateFormat = settings?.dateFormat ?? "DD/MM/YYYY";
    const cvLabels = getCvLanguageLabels(language);
    const sectionDisplay = (settings?.sectionDisplay ?? {}) as Record<string, { title?: string }>;

    const formatDate = (value: string) => formatCvDate(value, dateFormat, language);
    const formatDateRange = (start?: string, end?: string) =>
        [start, end].filter(Boolean).map((value) => formatDate(String(value))).join(" – ");

    /** Heading override from Customize wins over the built-in label. */
    const heading = (key: string, fallback: string) => {
        const custom = sectionDisplay[key]?.title;
        return custom && custom.trim() ? custom.trim() : fallback;
    };

    return {
        language,
        dateFormat,
        basics: buildBasics(resume, cvLabels),
        sections: getOrderedVisibleSections(resume).map((section) =>
            buildSection(section, { cvLabels, heading, formatDate, formatDateRange }),
        ),
    };
}

type CvLabels = ReturnType<typeof getCvLanguageLabels>;

function buildBasics(resume: Resume, cvLabels: CvLabels): DocumentModel["basics"] {
    const basics = resume.basics;
    const language = resume.settings?.language ?? "en";

    const links: DocumentLink[] = [];
    const pushLink = (url: string | undefined, label: string) => {
        const link = toDocumentLink(url, label);
        if (link) links.push(link);
    };

    pushLink(basics.website, basics.website);
    pushLink(basics.linkedin, "LinkedIn");
    pushLink(basics.github, "GitHub");
    for (const custom of basics.customLinks ?? []) {
        pushLink(custom.url, custom.label?.trim() || custom.name?.trim() || custom.url);
    }

    const optionalDetailLabels: Array<[string, string]> = [
        ["dateOfBirth", cvLabels.dateOfBirth],
        ["nationality", cvLabels.nationality],
        ["drivingLicense", cvLabels.drivingLicense],
        ["passportOrId", cvLabels.passportOrId],
        ["passport", cvLabels.passport],
        ["nationalId", cvLabels.nationalId],
        ["maritalStatus", cvLabels.maritalStatus],
        ["militaryService", cvLabels.militaryService],
        ["genderPronoun", cvLabels.genderPronoun],
        ["disability", cvLabels.disability],
        ["visa", cvLabels.visa],
        ["height", cvLabels.height],
    ];

    const detailById = new Map<string, DocumentDetail>();
    for (const [id, label] of optionalDetailLabels) {
        const raw = String((basics as unknown as Record<string, unknown>)[id] ?? "").trim();
        if (!raw) continue;

        if (id === "maritalStatus") {
            if (isHiddenMaritalStatus(raw)) continue;
            const value = isMaritalStatusKey(raw) ? getMaritalStatusLabel(raw, language) : raw;
            detailById.set(id, { label, value });
            continue;
        }

        if (id === "disability") {
            if (isHiddenDisability(raw)) continue;
            const value = isDisabilityKey(raw) ? getDisabilityLabel(raw, language) : raw;
            detailById.set(id, { label, value });
            continue;
        }

        detailById.set(id, { label, value: raw });
    }

    // The header's drag-to-reorder writes `detailsOrder`; unknown/new fields
    // keep their declaration order behind the stored ones, as in the preview.
    const storedOrder = (basics.detailsOrder ?? []).map((key) => key.replace(/^field:/, ""));
    const orderedIds = [
        ...storedOrder.filter((id) => detailById.has(id)),
        ...[...detailById.keys()].filter((id) => !storedOrder.includes(id)),
    ];

    return {
        name: basics.name?.trim() ?? "",
        headline: basics.headline?.trim() ?? "",
        summary: basics.summary?.trim() ?? "",
        summaryHeading: cvLabels.summary,
        emails: getResumeEmails(basics).map((entry) => ({
            label: entry.label,
            value: entry.email,
            url: `mailto:${entry.email}`,
        })),
        phone: basics.phone?.trim() ?? "",
        location: basics.location?.trim() ?? "",
        links,
        details: orderedIds.map((id) => detailById.get(id)!),
        photo: toDocumentImage(resume),
    };
}

/** Stored portrait content; the renderer owns rendered size and treatment. */
function toDocumentImage(resume: Resume): DocumentImage | null {
    const dataUrl = resume.basics?.photo?.trim();
    if (!dataUrl) return null;

    const match = /^data:([^;,]+)[;,]/.exec(dataUrl);
    if (!match) return null;

    return {
        dataUrl,
        mimeType: match[1],
        width: 96,
        height: 96,
        alt: resume.basics?.name?.trim() || "",
    };
}

interface SectionContext {
    cvLabels: CvLabels;
    heading: (key: string, fallback: string) => string;
    formatDate: (value: string) => string;
    formatDateRange: (start?: string, end?: string) => string;
}

function buildSection(section: OrderedResumeSection, ctx: SectionContext): DocumentSection {
    const { cvLabels, heading, formatDate, formatDateRange } = ctx;
    const make = (fallback: string) => emptySection(section.key, section.base, section.type, heading(section.base, fallback));

    switch (section.type) {
        case "experience": {
            const out = make(cvLabels.experience);
            out.entries = section.entries.map((exp) => ({
                ...emptyEntry(exp.id),
                title: exp.position || cvLabels.position,
                subtitle: exp.company ?? "",
                link: toDocumentLink(exp.url, exp.company || exp.url),
                dateRange: exp.start ? formatDateRange(exp.start, exp.end) : "",
                location: exp.location ?? "",
                body: exp.description ?? "",
                bullets: exp.description ? [] : cleanList(exp.highlights),
                tags: cleanList(exp.skills),
            }));
            return out;
        }
        case "education": {
            const out = make(cvLabels.education);
            out.entries = section.entries.map((edu) => ({
                ...emptyEntry(edu.id),
                title: edu.studyType || edu.area || cvLabels.degree,
                subtitle: edu.institution ?? "",
                link: toDocumentLink(edu.url, edu.institution || edu.url),
                dateRange: edu.start ? formatDateRange(edu.start, edu.end) : "",
                location: edu.location ?? "",
                body: edu.description ?? "",
                tags: cleanList(edu.skills),
                details: edu.score
                    ? [{ label: "", value: formatCvText(cvLabels.gpaScore, { score: edu.score }) }]
                    : [],
            }));
            return out;
        }
        case "courses": {
            const out = make(cvLabels.courses);
            out.entries = section.entries.map((course) => ({
                ...emptyEntry(course.id),
                title: course.name ?? "",
                subtitle: course.institution ?? "",
                link: toDocumentLink(course.url, course.institution || course.url),
                dateRange: course.start ? formatDateRange(course.start, course.end) : "",
                location: course.location ?? "",
                body: course.description ?? "",
                tags: cleanList(course.skills),
            }));
            return out;
        }
        case "certificates": {
            const out = make(cvLabels.certificates);
            out.entries = section.entries.map((cert) => ({
                ...emptyEntry(cert.id),
                title: cert.name || cvLabels.certificate,
                subtitle: cert.issuer ?? "",
                link: toDocumentLink(cert.issuerUrl || cert.url, cert.issuer || cert.issuerUrl || cert.url),
                dateRange: cert.date ? formatDate(cert.date) : "",
                body: cert.description ?? "",
                tags: cleanList(cert.skills),
            }));
            return out;
        }
        case "awards": {
            const out = make(cvLabels.awards);
            out.entries = section.entries.map((award) => ({
                ...emptyEntry(award.id),
                title: award.name ?? "",
                subtitle: award.issuer ?? "",
                link: toDocumentLink(award.url, award.issuer || award.url),
                dateRange: award.date ? formatDate(award.date) : "",
                body: award.description ?? "",
                tags: cleanList(award.skills),
            }));
            return out;
        }
        case "publications": {
            const out = make(cvLabels.publications);
            out.entries = section.entries.map((publication) => ({
                ...emptyEntry(publication.id),
                title: publication.name ?? "",
                subtitle: publication.publisher ?? "",
                link: toDocumentLink(publication.url, publication.publisher || publication.url),
                dateRange: publication.date ? formatDate(publication.date) : "",
                body: publication.description ?? "",
                tags: cleanList(publication.skills),
            }));
            return out;
        }
        case "references": {
            const out = make(cvLabels.references);
            out.entries = section.entries.map((reference) => ({
                ...emptyEntry(reference.id),
                title: reference.name ?? "",
                subtitle: [reference.position, reference.organisation].filter(Boolean).join(" · "),
                link: toDocumentLink(reference.url, reference.organisation || reference.url),
                body: reference.description ?? "",
                details: [
                    ...(reference.email
                        ? [{ label: "", value: reference.email, url: `mailto:${reference.email}` }]
                        : []),
                    ...(reference.phone
                        ? [{ label: "", value: reference.phone, url: `tel:${reference.phone}` }]
                        : []),
                ],
            }));
            return out;
        }
        case "declaration": {
            const out = make(cvLabels.declaration);
            out.entries = section.entries.map((declaration) => ({
                ...emptyEntry(declaration.id),
                title: declaration.fullName ?? "",
                body: declaration.text ?? "",
                details: [declaration.place, declaration.date].filter(Boolean).length > 0
                    ? [{ label: "", value: [declaration.place, declaration.date].filter(Boolean).join(" · ") }]
                    : [],
            }));
            return out;
        }
        case "projects": {
            const out = make(cvLabels.projects);
            out.entries = section.entries.map((project) => ({
                ...emptyEntry(project.id),
                title: project.name ?? "",
                subtitle: project.subtitle ?? "",
                link: toDocumentLink(project.url, project.subtitle || project.url),
                dateRange: project.start ? formatDateRange(project.start, project.end) : "",
                body: project.description ?? "",
                bullets: project.description ? [] : cleanList(project.highlights),
                tags: cleanList(project.skills),
                details: (project.repos ?? []).flatMap((repo) => {
                    const link = toDocumentLink(repo.url, repo.label?.trim() || repo.url);
                    return link ? [{ label: "", value: link.label, url: link.url }] : [];
                }),
            }));
            return out;
        }
        case "organisations": {
            const out = make(cvLabels.organisations);
            out.entries = section.entries.map((organisation) => ({
                ...emptyEntry(organisation.id),
                title: organisation.name ?? "",
                subtitle: organisation.role ?? "",
                link: toDocumentLink(organisation.url, organisation.role || organisation.url),
                dateRange: organisation.start ? formatDateRange(organisation.start, organisation.end) : "",
                location: organisation.location ?? "",
                body: organisation.description ?? "",
                tags: cleanList(organisation.skills),
            }));
            return out;
        }
        case "interests": {
            const out = make(cvLabels.interests || "Interests");
            out.entries = section.entries.map((interest) => ({
                ...emptyEntry(interest.id),
                title: interest.name || (cvLabels.interest ?? "Interest"),
                body: interest.description ?? "",
            }));
            return out;
        }
        case "languages": {
            const out = make(cvLabels.languages);
            out.entries = section.entries.map((entry) => ({
                ...emptyEntry(entry.id),
                title: entry.language ?? "",
                subtitle: entry.fluency ?? "",
                link: toDocumentLink(entry.assessmentUrl, entry.issuer || entry.assessmentUrl),
                body: entry.description ?? "",
                // A bare issuer and a bare id read as noise next to the
                // fluency. Both say what they are, in the CV's language.
                details: [...languageSkillDetails(entry, cvLabels), ...languageAssessmentDetails(entry, cvLabels)],
            }));
            return out;
        }
        case "skills": {
            const out = make(cvLabels.skills);
            out.skillGroups = section.groups.map((group) => ({
                name: group.name.trim(),
                skills: group.skills.map((skill) => skill.name.trim()).filter(Boolean),
            }));
            return out;
        }
        case "custom":
            return buildCustomSection(section.key, section.base, section.custom, ctx);
    }
}

/**
 * Per-skill CEFR levels as one line ("Listening C1 · Reading C2 · …"), so
 * text-based exports keep the grid the preview shows. Single-level entries
 * already say everything in their subtitle.
 */
function languageSkillDetails(
    entry: { fluency?: string; cefrDetailed?: boolean; cefr?: Partial<CefrSkillLevels> },
    cvLabels: CvLabels,
): DocumentDetail[] {
    if (!entry.cefrDetailed || isNativeLanguageFluency(entry.fluency ?? "")) return [];
    const assessed = assessedCefrSkills(entry.cefr);
    if (assessed.length === 0) return [];

    const skillLabels: Record<CefrSkill, string> = {
        listening: cvLabels.languageListening,
        reading: cvLabels.languageReading,
        spokenInteraction: cvLabels.languageSpokenInteraction,
        spokenProduction: cvLabels.languageSpokenProduction,
        writing: cvLabels.languageWriting,
    };
    return [{
        label: "",
        value: assessed.map((skill) => `${skillLabels[skill]} ${entry.cefr![skill]}`).join(" · "),
    }];
}

/**
 * How an entry says it was assessed. Native fluency is self-evident and says
 * nothing; everything else names its source before naming the value.
 */
function languageAssessmentDetails(
    entry: { fluency?: string; assessmentType?: string; issuer?: string; assessmentId?: string },
    cvLabels: CvLabels,
): DocumentDetail[] {
    if (isNativeLanguageFluency(entry.fluency ?? "")) return [];

    const details: DocumentDetail[] = [];
    if (entry.assessmentType === "issuer") {
        details.push({
            label: "",
            value: entry.issuer
                ? `${cvLabels.languageIssuerAssessed}: ${entry.issuer}`
                : cvLabels.languageIssuerAssessed,
        });
    } else if (entry.assessmentType === "self") {
        details.push({ label: "", value: cvLabels.languageSelfAssessed });
    } else if (entry.issuer) {
        details.push({ label: "", value: entry.issuer });
    }

    if (entry.assessmentId) {
        details.push({
            label: "",
            value: formatCvText(cvLabels.languageAssessmentIdValue, { id: entry.assessmentId }),
        });
    }
    return details;
}

function buildCustomSection(key: string, base: string, custom: CustomSection, ctx: SectionContext): DocumentSection {
    const { cvLabels, heading, formatDateRange } = ctx;
    const out = emptySection(key, base, "custom", heading(key, custom.title.trim() || cvLabels.customSection));

    if (custom.layout === "text") {
        out.text = custom.text.trim();
        return out;
    }

    if (custom.layout === "tags") {
        out.tags = cleanList(custom.tags);
        return out;
    }

    out.entries = visibleEntries(custom.entries ?? []).map((entry) => ({
        ...emptyEntry(entry.id),
        title: entry.title ?? "",
        subtitle: entry.subtitle ?? "",
        link: toDocumentLink(entry.url, entry.subtitle || entry.url),
        dateRange: entry.start ? formatDateRange(entry.start, entry.end) : "",
        location: entry.location ?? "",
        body: entry.description ?? "",
        tags: cleanList(entry.skills),
    }));

    return out;
}
