import { describe, expect, it } from "vitest";
import { resumeSchema } from "@/lib/schema";
import { candidateXml, PHOTO_DATA_URL, skillsPassportXml } from "./__fixtures__/europass-fixtures";
import { mapEuropassLanguage, mapEuropassToResume } from "./map-europass-to-resume";
import { parseEuropassXml } from "./parse";

describe("mapEuropassLanguage", () => {
    it("keeps every assessed skill and derives the overall level", () => {
        expect(mapEuropassLanguage({
            name: "English",
            native: false,
            levels: { listening: "C2", reading: "C2", spokenInteraction: "C1", spokenProduction: "C1", writing: "B2" },
            certificates: [],
        })).toEqual({
            fluency: "C1",
            cefrDetailed: true,
            cefr: { listening: "C2", reading: "C2", spokenInteraction: "C1", spokenProduction: "C1", writing: "B2" },
            description: "",
        });
    });

    it("handles partial, unrated, native and certified languages", () => {
        expect(mapEuropassLanguage({ name: "Czech", native: false, levels: { listening: "A2", reading: "B1" }, certificates: [] }))
            .toMatchObject({ fluency: "A2", cefrDetailed: true, cefr: { listening: "A2", reading: "B1", writing: "" } });
        expect(mapEuropassLanguage({ name: "Latin", native: false, levels: {}, certificates: [] }))
            .toMatchObject({ fluency: "", cefrDetailed: false });
        expect(mapEuropassLanguage({ name: "Bosnian", native: true, levels: {}, certificates: [] }))
            .toMatchObject({ fluency: "Native", cefrDetailed: false, description: "" });
        expect(mapEuropassLanguage({ name: "German", native: false, levels: { writing: "B1" }, certificates: ["Goethe B1"] }).description)
            .toBe("Certificates: Goethe B1");
    });
});

describe("mapEuropassToResume", () => {
    it("maps a current Europass CV into a valid resume", () => {
        const resume = mapEuropassToResume(parseEuropassXml(candidateXml()));
        expect(() => resumeSchema.parse(resume)).not.toThrow();

        expect(resume.meta.title).toBe("Amina Kovačević — Europass import");
        expect(resume.basics).toMatchObject({
            name: "Amina Kovačević",
            // The summary keeps Europass emphasis as Markdown, like descriptions.
            summary: "Backend engineer with *ten years* of experience.",
            photo: PHOTO_DATA_URL,
            email: "amina@example.com",
            phone: "+387 61123456",
            location: "Sarajevo, Bosnia & Herzegovina",
            website: "https://amina.github.io",
            linkedin: "https://www.linkedin.com/in/amina-example",
            github: "https://github.com/amina-example",
            drivingLicense: "B, A1",
            dateOfBirth: "1992-04-12",
            nationality: "BA",
        });
        // Invalid addresses are dropped rather than failing the whole import.
        expect(resume.basics.emails.map((entry) => entry.email)).toEqual(["amina@example.com"]);
        expect(resume.basics.customLinks).toMatchObject([{ name: "Portfolio", url: "https://portfolio.example.com" }]);

        expect(resume.experience.map((entry) => [entry.company, entry.position, entry.start, entry.end])).toEqual([
            ["Balkan Payments", "Engineering Lead", "2021-03", "Present"],
            ["Balkan Payments", "Backend Developer", "2017", "2021-02"],
        ]);
        expect(resume.education[0]).toMatchObject({ institution: "University of Sarajevo", studyType: "MSc Computer Science", score: "9.4" });
        expect(resume.languages.map((language) => [language.language, language.fluency, language.assessmentType, language.cefrDetailed])).toEqual([
            ["Bosnian", "Native", "none", false],
            ["English", "C1", "self", true],
            ["Ladino", "A2", "self", true],
        ]);
        expect(resume.languages[1].cefr).toEqual({ listening: "C2", reading: "C2", spokenInteraction: "C1", spokenProduction: "C1", writing: "B2" });
        expect(resume.settings.sectionDisplay.languages?.languageLayout).toBe("cefr");
        expect(resume.skillGroups[0].skills.map((skill) => skill.name)).toEqual(["TypeScript", "PostgreSQL"]);
        expect(resume.certificates[0]).toMatchObject({ name: "AWS Solutions Architect", issuer: "Amazon Web Services", date: "2022-05" });
        expect(resume.publications[0]).toMatchObject({ name: "Idempotent payment APIs", publisher: "Engineering Journal" });
        expect(resume.references[0]).toMatchObject({ name: "Emir Hodžić", position: "CTO", email: "emir@example.com" });
        expect(resume.projects[0]).toMatchObject({ name: "Open banking gateway", end: "Present" });
        expect(resume.interests.map((interest) => interest.name)).toEqual(["Mountain running"]);

        expect(resume.customSections.map((section) => [section.title, section.layout, section.entries.length])).toEqual([
            ["Conferences and seminars", "entries", 1],
            ["Awards", "entries", 2],
            ["Communication and interpersonal skills", "text", 0],
        ]);

        const customKeys = resume.customSections.map((section) => `custom:${section.id}`);
        expect(resume.settings.contentSections).toEqual([
            "experience",
            "education",
            "languages",
            "skills",
            "certificates",
            "projects",
            "publications",
            ...customKeys,
            "interests",
            "references",
        ]);
    });

    it("maps a legacy Europass CV", () => {
        const resume = mapEuropassToResume(parseEuropassXml(skillsPassportXml()));
        expect(resume.basics).toMatchObject({
            name: "Luka Perić",
            headline: "Site Reliability Engineer",
            website: "https://luka.example.com",
            drivingLicense: "B, C",
            nationality: "HR",
        });
        expect(resume.education[0]).toMatchObject({ studyType: "Master of Electrical Engineering", area: "Engineering" });
        expect(resume.languages[1]).toMatchObject({
            language: "German",
            fluency: "B1",
            cefrDetailed: true,
            cefr: { listening: "B2", reading: "B2", spokenInteraction: "B1", spokenProduction: "B1", writing: "A2" },
            description: "Certificates: Goethe-Zertifikat B1",
        });
        expect(resume.customSections.map((section) => section.title)).toEqual(["Communication skills", "Digital skills", "Publications"]);
    });

    it("gives every import fresh custom section ids", () => {
        const cv = parseEuropassXml(candidateXml());
        const first = mapEuropassToResume(cv).customSections.map((section) => section.id);
        const second = mapEuropassToResume(cv).customSections.map((section) => section.id);
        expect(first.some((id) => second.includes(id))).toBe(false);
    });
});
