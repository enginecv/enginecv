import { z } from "zod";
import { markdownToPlainText } from "@/lib/export-plaintext";
import { createId } from "@/lib/id";
import { createEmptyResume, createUngroupedSkillGroup, resumeSchema, type Resume } from "@/lib/schema";
import { deriveOverallCefrLevel, emptyCefrSkillLevels, type CefrSkillLevels } from "@/lib/cefr";
import { uniqueImportId } from "../ids";
import type { EuropassLanguage, ParsedEuropassCv } from "./parse";

const emailSchema = z.string().email();

function validEmail(value: string): string {
    return emailSchema.safeParse(value.trim()).success ? value.trim() : "";
}

function joinNonEmpty(parts: string[], separator: string): string {
    return parts.map((part) => part.trim()).filter(Boolean).join(separator);
}

/**
 * Europass self-assesses five skills; they map one to one onto EngineCV's
 * detailed CEFR grid, with the overall level derived from them.
 */
export function mapEuropassLanguage(language: EuropassLanguage): {
    fluency: string;
    cefrDetailed: boolean;
    cefr: CefrSkillLevels;
    description: string;
} {
    const cefr = { ...emptyCefrSkillLevels(), ...language.levels };
    if (language.native) return { fluency: "Native", cefrDetailed: false, cefr, description: "" };

    const fluency = deriveOverallCefrLevel(cefr);
    const certificates = language.certificates.length > 0 ? `Certificates: ${language.certificates.join(", ")}` : "";
    return { fluency, cefrDetailed: fluency !== "", cefr, description: certificates };
}

export function mapEuropassToResume(cv: ParsedEuropassCv): Resume {
    const base = createEmptyResume();
    const { person } = cv;
    const name = joinNonEmpty([person.givenName, person.familyName], " ");

    const emails = Array.from(new Set(person.emails.map(validEmail).filter(Boolean)));
    const websites = person.links.filter((link) => link.kind === "website");
    const linkedin = person.links.find((link) => link.kind === "linkedin");
    const github = person.links.find((link) => link.kind === "github");
    const extraLinks = [
        ...websites.slice(1),
        ...person.links.filter((link) => link.kind === "linkedin" && link !== linkedin),
        ...person.links.filter((link) => link.kind === "github" && link !== github),
    ];

    const experienceIds = new Set<string>();
    const experience = cv.experience.map((entry) => ({
        id: uniqueImportId("europass-experience", entry.organisation || entry.position, experienceIds),
        company: entry.organisation,
        position: entry.position,
        start: entry.start,
        end: entry.end,
        location: entry.location,
        description: entry.description,
        highlights: [],
        skills: [],
        url: entry.url,
        urlIcon: "auto",
    }));

    const educationIds = new Set<string>();
    const education = cv.education.map((entry) => ({
        id: uniqueImportId("europass-education", entry.organisation || entry.qualification, educationIds),
        institution: entry.organisation,
        studyType: entry.qualification,
        area: entry.field,
        start: entry.start,
        end: entry.end,
        location: entry.location,
        description: entry.description,
        score: entry.score,
        courses: [],
        skills: [],
        url: entry.url,
        urlIcon: "auto",
    }));

    const languageIds = new Set<string>();
    const languages = cv.languages.map((language) => {
        const { fluency, cefrDetailed, cefr, description } = mapEuropassLanguage(language);
        return {
            id: uniqueImportId("europass-language", language.name, languageIds),
            language: language.name,
            fluency,
            cefrDetailed,
            cefr,
            assessmentType: language.native || !fluency ? ("none" as const) : ("self" as const),
            issuer: "",
            assessmentId: "",
            assessmentUrl: "",
            description,
        };
    });

    const skillIds = new Set<string>();
    const skillGroups = [
        createUngroupedSkillGroup(cv.skills.map((skill) => ({
            id: uniqueImportId("europass-skill", skill, skillIds),
            name: skill,
            description: "",
            level: "",
            hidden: false,
            icon: "auto",
            display: "both" as const,
            keywords: [],
        }))),
    ];

    const projectIds = new Set<string>();
    const projects = cv.projects.map((entry) => ({
        id: uniqueImportId("europass-project", entry.title, projectIds),
        name: entry.title,
        subtitle: "",
        description: entry.description,
        highlights: [],
        keywords: [],
        skills: [],
        start: entry.start,
        end: entry.end,
        url: entry.url,
        urlIcon: "auto",
        repos: [],
    }));

    const courseIds = new Set<string>();
    const courses = cv.courses.map((entry) => ({
        id: uniqueImportId("europass-course", entry.title, courseIds),
        name: entry.title,
        institution: "",
        start: entry.start,
        end: entry.end,
        location: entry.location,
        description: entry.description,
        skills: [],
        url: entry.url,
        urlIcon: "auto",
    }));

    const certificateIds = new Set<string>();
    const certificates = cv.certifications.map((entry) => ({
        id: uniqueImportId("europass-certificate", entry.name, certificateIds),
        name: entry.name,
        issuer: entry.issuer,
        date: entry.date,
        description: entry.description,
        skills: [],
        url: entry.url,
        urlIcon: "auto",
        issuerUrl: "",
        issuerUrlIcon: "auto",
    }));

    const publicationIds = new Set<string>();
    const publications = cv.publications.map((entry) => ({
        id: uniqueImportId("europass-publication", entry.title, publicationIds),
        name: entry.title,
        publisher: entry.publisher,
        date: entry.date,
        description: entry.description,
        skills: [],
        url: entry.url,
        urlIcon: "auto",
    }));

    const referenceIds = new Set<string>();
    const references = cv.references.map((entry) => ({
        id: uniqueImportId("europass-reference", entry.name, referenceIds),
        name: entry.name,
        position: entry.position,
        organisation: "",
        email: validEmail(entry.email),
        phone: entry.phone,
        description: entry.description,
        url: "",
        urlIcon: "auto",
    }));

    const interestIds = new Set<string>();
    const interests = cv.interests.map((entry) => ({
        id: uniqueImportId("europass-interest", entry.title, interestIds),
        name: entry.title,
        description: entry.description,
    }));

    // Custom section ids join `custom:<id>` keys, so they must stay unique
    // across imports into the same browser; entry ids only need local uniqueness.
    const customSections = [
        ...cv.activitySections.map((section) => {
            const entryIds = new Set<string>();
            return {
                id: createId(),
                title: section.title,
                icon: "auto",
                layout: "entries" as const,
                text: "",
                tags: [],
                entries: section.entries.map((entry) => ({
                    id: uniqueImportId("europass-entry", entry.title, entryIds),
                    title: entry.title,
                    subtitle: "",
                    start: entry.start,
                    end: entry.end,
                    location: entry.location,
                    description: entry.description,
                    skills: [],
                    url: entry.url,
                    urlIcon: "auto",
                })),
            };
        }),
        ...cv.textSections.map((section) => ({
            id: createId(),
            title: section.title,
            icon: "auto",
            layout: "text" as const,
            text: section.text,
            tags: [],
            entries: [],
        })),
    ];

    const contentSections = [
        ...(experience.length > 0 ? ["experience"] : []),
        ...(education.length > 0 ? ["education"] : []),
        ...(languages.length > 0 ? ["languages"] : []),
        ...(skillGroups[0].skills.length > 0 ? ["skills"] : []),
        ...(certificates.length > 0 ? ["certificates"] : []),
        ...(courses.length > 0 ? ["courses"] : []),
        ...(projects.length > 0 ? ["projects"] : []),
        ...(publications.length > 0 ? ["publications"] : []),
        ...customSections.map((section) => `custom:${section.id}`),
        ...(interests.length > 0 ? ["interests"] : []),
        ...(references.length > 0 ? ["references"] : []),
    ];

    return resumeSchema.parse({
        ...base,
        id: undefined,
        createdAt: 0,
        updatedAt: 0,
        basics: {
            ...base.basics,
            name,
            headline: person.headline,
            // Markdown, like entry descriptions: the preview renders it.
            summary: person.summary,
            photo: person.photo,
            // `emails` is authoritative; its first entry is mirrored into `email`.
            email: emails[0] ?? "",
            emails: emails.map((email) => ({ email, label: "" })),
            phone: person.phones[0] ?? "",
            location: person.location,
            website: websites[0]?.url ?? "",
            linkedin: linkedin?.url ?? "",
            github: github?.url ?? "",
            drivingLicense: person.drivingLicences.join(", "),
            dateOfBirth: person.dateOfBirth,
            nationality: /^[A-Z]{2}$/.test(person.nationality) ? person.nationality : "",
            customLinks: extraLinks.map((link) => ({
                name: link.label || new URL(link.url).hostname.replace(/^www\./, ""),
                url: link.url,
                label: "",
                icon: "auto",
            })),
        },
        meta: {
            ...base.meta,
            title: name ? `${name} — Europass import` : "Europass import",
        },
        experience,
        education,
        languages,
        skillGroups,
        projects,
        courses,
        certificates,
        publications,
        references,
        interests,
        customSections,
        settings: {
            ...base.settings,
            contentSections,
            // Rated languages read best in the grid Europass itself uses.
            sectionDisplay: languages.some((language) => language.cefrDetailed)
                ? { ...base.settings.sectionDisplay, languages: { languageLayout: "cefr" } }
                : base.settings.sectionDisplay,
        },
    });
}
