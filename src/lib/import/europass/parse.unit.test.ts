import { describe, expect, it } from "vitest";
import { candidateXml, PHOTO_DATA_URL, skillsPassportXml } from "./__fixtures__/europass-fixtures";
import { normalizeEuropassDate, parseEuropassXml } from "./parse";

describe("normalizeEuropassDate", () => {
    it("keeps year or year-month precision", () => {
        expect(normalizeEuropassDate("2016")).toBe("2016");
        expect(normalizeEuropassDate("2021-06-06")).toBe("2021-06");
        expect(normalizeEuropassDate("2021-06-06T10:00:00")).toBe("2021-06");
        expect(normalizeEuropassDate("June 2021")).toBe("");
    });
});

describe("parseEuropassXml — current Europass (Candidate)", () => {
    const cv = parseEuropassXml(candidateXml());

    it("reads identity, contact details and the photo", () => {
        expect(cv.format).toBe("europass");
        expect(cv.locale).toBe("en");
        expect(cv.person).toMatchObject({
            givenName: "Amina",
            familyName: "Kovačević",
            summary: "Backend engineer with *ten years* of experience.",
            emails: ["amina@example.com", "not-an-email"],
            phones: ["+387 61123456"],
            location: "Sarajevo, Bosnia & Herzegovina",
            dateOfBirth: "1992-04-12",
            nationality: "BA",
            photo: PHOTO_DATA_URL,
            drivingLicences: ["B", "A1"],
        });
        expect(cv.person.links).toEqual([
            { url: "https://www.linkedin.com/in/amina-example", kind: "linkedin", label: "linkedin" },
            { url: "https://amina.github.io", kind: "website", label: "personal" },
            { url: "https://github.com/amina-example", kind: "github", label: "github" },
            { url: "https://portfolio.example.com", kind: "website", label: "Portfolio" },
        ]);
    });

    it("creates one experience entry per position", () => {
        expect(cv.experience).toEqual([
            {
                organisation: "Balkan Payments",
                position: "Engineering Lead",
                start: "2021-03",
                end: "Present",
                location: "Sarajevo, Bosnia & Herzegovina",
                description: "Led the **payments** platform team.\n\n- Cut checkout latency by 40%\n- Stack: Go, PostgreSQL",
                url: "https://payments.example.com",
            },
            {
                organisation: "Balkan Payments",
                position: "Backend Developer",
                start: "2017",
                end: "2021-02",
                location: "Mostar, Bosnia & Herzegovina",
                description: "",
                url: "https://payments.example.com",
            },
        ]);
    });

    it("reads education with grade, thesis and organisation website", () => {
        expect(cv.education).toEqual([{
            organisation: "University of Sarajevo",
            qualification: "MSc Computer Science",
            field: "",
            start: "2012-10",
            end: "2015-07",
            location: "Sarajevo, Bosnia & Herzegovina",
            description: "Distributed systems\n\nThesis: Consensus under partitions",
            score: "9.4",
            url: "https://www.unsa.example",
        }]);
    });

    it("reads the mother tongue and the CEFR self-assessment grid", () => {
        expect(cv.languages).toEqual([
            { name: "Bosnian", native: true, levels: {}, certificates: [] },
            {
                name: "English",
                native: false,
                levels: { listening: "C2", reading: "C2", spokenInteraction: "C1", spokenProduction: "C1", writing: "B2" },
                certificates: [],
            },
            { name: "Ladino", native: false, levels: { listening: "A2" }, certificates: [] },
        ]);
    });

    it("reads skills, certificates, publications, references, projects and interests", () => {
        expect(cv.skills).toEqual(["TypeScript", "PostgreSQL"]);
        expect(cv.certifications).toEqual([{
            name: "AWS Solutions Architect",
            issuer: "Amazon Web Services",
            date: "2022-05",
            description: "Professional level",
            url: "https://aws.example.com/cert/123",
        }]);
        expect(cv.publications).toEqual([{
            title: "Idempotent payment APIs",
            publisher: "Engineering Journal",
            date: "2023",
            description: "",
            url: "https://journal.example.com/idempotency",
        }]);
        expect(cv.references).toEqual([{
            name: "Emir Hodžić",
            position: "CTO",
            email: "emir@example.com",
            phone: "",
            description: "Direct manager 2021–2024",
        }]);
        expect(cv.projects).toEqual([{
            title: "Open banking gateway",
            start: "2020-01",
            end: "Present",
            location: "",
            description: "PSD2 adapter used by [three banks](https://bank.example.com).",
            url: "https://gateway.example.com",
        }]);
        expect(cv.interests.map((interest) => interest.title)).toEqual(["Mountain running"]);
    });

    it("merges repeated sections and keeps free-text skills", () => {
        expect(cv.activitySections).toEqual([
            {
                title: "Conferences and seminars",
                entries: [{ title: "GopherCon EU talk", start: "2023-06", end: "", location: "Berlin", description: "", url: "" }],
            },
            {
                title: "Awards",
                entries: [
                    { title: "Best fintech hack 2019", start: "", end: "", location: "", description: "", url: "" },
                    { title: "Employee of the year 2022", start: "", end: "", location: "", description: "", url: "" },
                ],
            },
        ]);
        expect(cv.textSections).toEqual([
            { title: "Communication and interpersonal skills", text: "Mentored six junior engineers." },
        ]);
    });
});

describe("parseEuropassXml — legacy Europass (SkillsPassport)", () => {
    const cv = parseEuropassXml(skillsPassportXml());

    it("reads identity and contact details", () => {
        expect(cv.format).toBe("legacy");
        expect(cv.person).toMatchObject({
            givenName: "Luka",
            familyName: "Perić",
            headline: "Site Reliability Engineer",
            summary: "",
            emails: ["luka@example.com"],
            phones: ["+385 91 555 0101"],
            location: "Zagreb, Croatia",
            links: [{ url: "https://luka.example.com", kind: "website", label: "personal" }],
            dateOfBirth: "1988-07-03",
            nationality: "HR",
            photo: PHOTO_DATA_URL,
            drivingLicences: ["B", "C"],
        });
    });

    it("reads work, education and languages", () => {
        expect(cv.experience).toEqual([{
            organisation: "Adriatic Cloud",
            position: "SRE",
            start: "2016-09",
            end: "Present",
            location: "Split, Croatia",
            description: "- On-call lead\n- Terraform modules",
            url: "https://adriatic.example.com",
        }]);
        expect(cv.education).toEqual([{
            organisation: "University of Zagreb",
            qualification: "Master of Electrical Engineering",
            field: "Engineering",
            start: "2007",
            end: "2012-06",
            location: "",
            description: "Control systems",
            score: "",
            url: "",
        }]);
        expect(cv.languages).toEqual([
            { name: "Croatian", native: true, levels: {}, certificates: [] },
            {
                name: "German",
                native: false,
                levels: { listening: "B2", reading: "B2", spokenInteraction: "B1", spokenProduction: "B1", writing: "A2" },
                certificates: ["Goethe-Zertifikat B1"],
            },
        ]);
    });

    it("keeps skill categories and achievements as text sections", () => {
        expect(cv.textSections).toEqual([
            { title: "Communication skills", text: "Clear incident communication" },
            { title: "Digital skills", text: "Linux, Kubernetes" },
            { title: "Publications", text: "SRE handbook chapter" },
        ]);
    });
});

describe("parseEuropassXml — failures", () => {
    it("classifies malformed and foreign XML", () => {
        expect(() => parseEuropassXml("<Candidate><oops></Candidate>")).toThrow(expect.objectContaining({ failureClass: "corrupt-file" }));
        expect(() => parseEuropassXml("<resume/>")).toThrow(expect.objectContaining({ failureClass: "no-europass-data" }));
    });
});
