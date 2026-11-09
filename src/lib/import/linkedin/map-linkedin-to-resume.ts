import { createUngroupedSkillGroup, resumeSchema, type Resume } from "@/lib/schema";
import { createNewResume } from "@/lib/templates/default-design";
import { uniqueImportId } from "../ids";
import type { ParsedLinkedinArchive } from "./archive";
import { parseLinkedinDate } from "./dates";

/** First URL out of LinkedIn's "[TYPE:url,TYPE:url]" Websites list format. */
function firstWebsite(websites: string): string {
    const match = /https?:\/\/[^,\]\s]+/.exec(websites);
    return match ? match[0] : "";
}

function splitDegreeName(degreeName: string): { studyType: string; area: string } {
    const commaIndex = degreeName.indexOf(",");
    if (commaIndex === -1) {
        return { studyType: degreeName, area: "" };
    }
    return {
        studyType: degreeName.slice(0, commaIndex).trim(),
        area: degreeName.slice(commaIndex + 1).trim(),
    };
}

function joinNonEmpty(parts: string[], separator: string): string {
    return parts.filter((part) => part !== "").join(separator);
}

export function mapLinkedinToResume(parsed: ParsedLinkedinArchive): Resume {
    const base = createNewResume();

    const experienceIds = new Set<string>();
    const experience = parsed.positions.map((position) => ({
        company: position.companyName,
        position: position.title,
        description: position.description,
        location: position.location,
        start: parseLinkedinDate(position.startedOn),
        end: parseLinkedinDate(position.finishedOn),
        highlights: [],
        skills: [],
        url: "",
        urlIcon: "auto",
        id: uniqueImportId("linkedin-experience", position.companyName || position.title, experienceIds),
    }));

    const educationIds = new Set<string>();
    const education = parsed.education.map((entry) => {
        const { studyType, area } = splitDegreeName(entry.degreeName);
        return {
            institution: entry.schoolName,
            studyType,
            area,
            start: parseLinkedinDate(entry.startDate),
            end: parseLinkedinDate(entry.endDate),
            location: "",
            description: joinNonEmpty([entry.notes, entry.activities], "\n"),
            score: "",
            courses: [],
            skills: [],
            url: "",
            urlIcon: "auto",
            id: uniqueImportId("linkedin-education", entry.schoolName || entry.degreeName, educationIds),
        };
    });

    const skillIds = new Set<string>();
    const skillGroups = [
        createUngroupedSkillGroup(parsed.skills.map((skill) => ({
            id: uniqueImportId("linkedin-skill", skill.name, skillIds),
            name: skill.name,
            description: "",
            level: "",
            hidden: false,
            icon: "auto",
            display: "both" as const,
            keywords: [],
        }))),
    ];

    const certificateIds = new Set<string>();
    const certificates = parsed.certifications.map((certification) => ({
        id: uniqueImportId("linkedin-certificate", certification.name, certificateIds),
        name: certification.name,
        issuer: certification.authority,
        date: parseLinkedinDate(certification.startedOn),
        description: certification.licenseNumber ? `License ${certification.licenseNumber}` : "",
        skills: [],
        url: certification.url,
        urlIcon: "auto",
        issuerUrl: "",
        issuerUrlIcon: "auto",
    }));

    const languageIds = new Set<string>();
    const languages = parsed.languages.map((language) => ({
        id: uniqueImportId("linkedin-language", language.name, languageIds),
        language: language.name,
        fluency: language.proficiency,
        assessmentType: "self" as const,
        issuer: "",
        assessmentId: "",
        assessmentUrl: "",
        description: "",
    }));

    const projectIds = new Set<string>();
    const projects = parsed.projects.map((project) => ({
        id: uniqueImportId("linkedin-project", project.title, projectIds),
        name: project.title,
        subtitle: "",
        description: project.description,
        highlights: [],
        keywords: [],
        skills: [],
        start: parseLinkedinDate(project.startedOn),
        end: parseLinkedinDate(project.finishedOn),
        url: project.url,
        urlIcon: "auto",
        repos: [],
    }));

    const profile = parsed.profile;
    const name = profile ? joinNonEmpty([profile.firstName, profile.lastName], " ") : "";

    const contentSections = [
        ...(experience.length > 0 ? ["experience"] : []),
        ...(education.length > 0 ? ["education"] : []),
        ...(certificates.length > 0 ? ["certificates"] : []),
        ...(projects.length > 0 ? ["projects"] : []),
        ...(skillGroups[0].skills.length > 0 ? ["skills"] : []),
        ...(languages.length > 0 ? ["languages"] : []),
    ];

    return resumeSchema.parse({
        ...base,
        id: undefined,
        createdAt: 0,
        updatedAt: 0,
        basics: {
            ...base.basics,
            name,
            headline: profile?.headline ?? "",
            summary: profile?.summary ?? "",
            location: profile?.geoLocation ?? "",
            website: profile ? firstWebsite(profile.websites) : "",
        },
        meta: {
            ...base.meta,
            title: name ? `${name} — LinkedIn import` : "LinkedIn import",
        },
        experience,
        education,
        certificates,
        projects,
        skillGroups,
        languages,
        settings: {
            ...base.settings,
            contentSections,
        },
    });
}
