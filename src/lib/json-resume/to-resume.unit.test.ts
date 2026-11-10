import { describe, expect, it } from "vitest";
import { resumeSchema } from "@/lib/schema";
import full from "@/lib/__fixtures__/json-resume/full.json";
import minimal from "@/lib/__fixtures__/json-resume/minimal.json";
import { jsonResumeToResume } from "./to-resume";
import type { ConversionReport } from "./report";

function item(report: ConversionReport, code: string, section = "") {
    return report.items.find((entry) => entry.code === code && entry.section === section);
}

describe("jsonResumeToResume", () => {
    const result = jsonResumeToResume(full, { now: 1 });
    const { resume } = result;

    it("produces a CV that passes the resume schema", () => {
        expect(resumeSchema.safeParse(resume).success).toBe(true);
    });

    it("maps basics, including profiles and links", () => {
        expect(resume.basics).toMatchObject({
            name: "John Doe",
            headline: "Senior Software Engineer",
            email: "john@example.com",
            phone: "(912) 555-4321",
            website: "https://johndoe.example.com",
            linkedin: "https://www.linkedin.com/in/johndoe",
            github: "https://github.com/johndoe",
        });
        expect(resume.basics.customLinks).toMatchObject([{ name: "Mastodon", url: "https://mastodon.example/@john", label: "john" }]);
    });

    it("keeps the address parts and builds the display location", () => {
        expect(resume.basics.locationParts).toEqual({
            address: "2712 Broadway St",
            postalCode: "CA 94115",
            city: "San Francisco",
            region: "California",
            countryCode: "US",
        });
        expect(resume.basics.location).toBe("San Francisco, California, United States");
    });

    it("maps every section and counts the entries", () => {
        expect(result.counts).toMatchObject({
            experience: 2, organisations: 1, education: 1, awards: 1, certificates: 1,
            publications: 1, skills: 3, languages: 2, interests: 1, references: 1, projects: 1,
        });
        expect(resume.experience[0]).toMatchObject({
            company: "Acme Systems", position: "Senior Engineer", location: "Remote", description: "Led the order platform team.",
            start: "2019-06", end: "Present", url: "https://acme.example.com",
        });
        expect(resume.experience[0].highlights).toHaveLength(2);
        expect(resume.experience[1]).toMatchObject({ company: "Globex", start: "2015", end: "2019-05" });
        expect(resume.organisations[0]).toMatchObject({ name: "Code for Good", role: "Mentor", start: "2018-01", end: "2020-12" });
        expect(resume.education[0]).toMatchObject({ institution: "Northfield University", area: "Computer Science", studyType: "Bachelor", score: "3.8", courses: ["Algorithms", "Databases"] });
        expect(resume.awards[0]).toMatchObject({ name: "Engineer of the Year", issuer: "Acme Systems", date: "2021-03" });
        expect(resume.certificates[0]).toMatchObject({ name: "Certified Kubernetes Administrator", issuer: "CNCF", date: "2020-07" });
        expect(resume.publications[0]).toMatchObject({ name: "Fast exports at scale", publisher: "Dev Journal", date: "2022-02" });
        expect(resume.projects[0]).toMatchObject({ name: "Fast Export", subtitle: "Open source", keywords: ["Go", "CSV"], start: "2021-01", end: "2022-06" });
        expect(resume.references[0]).toMatchObject({ name: "Jane Doe", description: "John led our platform team with calm and clarity." });
        expect(resume.languages[0]).toMatchObject({ language: "English", fluency: "Native" });
        expect(resume.languages[1]).toMatchObject({ language: "German", fluency: "B2" });
    });

    it("maps skills and their levels", () => {
        const skills = resume.skillGroups.flatMap((group) => group.skills);
        expect(skills.map((skill) => [skill.name, skill.level])).toEqual([["Go", "expert"], ["PostgreSQL", "competent"], ["Distributed systems", ""]]);
        expect(skills[0].keywords).toEqual(["Concurrency", "gRPC"]);
        expect(skills[2].description).toBe("Wizard");
    });

    it("shows the sections that have entries", () => {
        expect(resume.settings.contentSections).toEqual(
            ["experience", "organisations", "education", "awards", "certificates", "publications", "skills", "languages", "interests", "references", "projects"],
        );
    });

    it("reports what did not carry over", () => {
        expect(item(result.report, "photo-url-not-fetched", "basics")?.count).toBe(1);
        expect(item(result.report, "date-day-dropped", "experience")?.count).toBe(1);
        expect(item(result.report, "date-day-dropped", "publications")?.count).toBe(1);
        expect(item(result.report, "company-description-left-out", "experience")?.count).toBe(1);
        expect(item(result.report, "project-roles-left-out", "projects")).toBeDefined();
        expect(item(result.report, "project-type-left-out", "projects")).toBeDefined();
        expect(item(result.report, "volunteer-highlights-folded", "organisations")).toBeDefined();
        expect(item(result.report, "interest-keywords-folded", "interests")).toBeDefined();
        expect(item(result.report, "skill-level-kept-as-text", "skills")?.count).toBe(1);
        expect(item(result.report, "theme-left-out")).toBeDefined();
        expect(item(result.report, "unknown-keys-ignored")?.count).toBe(1);
    });

    it("folds volunteer highlights and interest keywords into descriptions", () => {
        expect(resume.organisations[0].description).toBe("Taught web basics to beginners.\n\n- Ran 20 workshops");
        expect(resume.interests[0].description).toBe("Bouldering, Alpine");
    });

    it("does not fetch a photo web address", () => {
        expect(resume.basics.photo).toBe("");
    });
});

describe("jsonResumeToResume edge cases", () => {
    it("imports a minimal document with an empty report", () => {
        const { resume, report } = jsonResumeToResume(minimal);
        expect(resume.basics.name).toBe("Jane Doe");
        expect(report.items).toEqual([]);
        expect(resume.settings.contentSections).toEqual([]);
    });

    it("returns an empty CV and a report for input that is not an object", () => {
        for (const input of [null, "text", 5, [], undefined]) {
            const { resume, report } = jsonResumeToResume(input);
            expect(resume.basics.name).toBe("");
            expect(report.items.length).toBeGreaterThan(0);
        }
    });

    it("skips empty entries and unusable fields without failing", () => {
        const { resume, report } = jsonResumeToResume({
            basics: { name: "A", url: "javascript:alert(1)" },
            work: [{}, "nope", { name: "Acme", startDate: "June 2019" }, { position: "Dev", startDate: "garbage" }],
        });
        expect(resume.experience.map((entry) => entry.company)).toEqual(["Acme", ""]);
        expect(resume.basics.website).toBe("");
        expect(item(report, "empty-entries-skipped", "experience")?.count).toBe(1);
        expect(item(report, "invalid-values-skipped", "experience")?.count).toBeGreaterThanOrEqual(2);
        expect(item(report, "invalid-values-skipped", "basics")?.count).toBe(1);
    });

    it("keeps a photo that is embedded as data", () => {
        const { resume, report } = jsonResumeToResume({ basics: { image: "data:image/png;base64,AAAA" } });
        expect(resume.basics.photo).toBe("data:image/png;base64,AAAA");
        expect(item(report, "photo-url-not-fetched", "basics")).toBeUndefined();
    });

    it("treats a work entry with a start but no end as current, and one with neither as open", () => {
        const { resume } = jsonResumeToResume({ work: [{ name: "A", startDate: "2020" }, { name: "B" }] });
        expect(resume.experience.map((entry) => entry.end)).toEqual(["Present", ""]);
    });

    it("reads three date precisions", () => {
        const { resume } = jsonResumeToResume({ education: [{ institution: "U", startDate: "2011", endDate: "2015-06-30" }] });
        expect(resume.education[0]).toMatchObject({ start: "2011", end: "2015-06" });
    });
});
