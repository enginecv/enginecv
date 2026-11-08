import { describe, expect, it } from "vitest";
import { resumeSchema } from "@/lib/schema";
import type { ParsedLinkedinArchive } from "./archive";
import { mapLinkedinToResume } from "./map-linkedin-to-resume";

function emptyParsed(overrides: Partial<ParsedLinkedinArchive> = {}): ParsedLinkedinArchive {
    return {
        positions: [],
        education: [],
        skills: [],
        certifications: [],
        languages: [],
        projects: [],
        filesFound: [],
        filesMissing: [],
        skippedRows: {},
        ignoredInputs: [],
        ...overrides,
    };
}

const fullParsed = (): ParsedLinkedinArchive =>
    emptyParsed({
        profile: {
            firstName: "Amina",
            lastName: "Kovačević",
            headline: "Senior Software Engineer",
            summary: "Builder of local-first tools.",
            industry: "Computer Software",
            geoLocation: "Sarajevo, Bosnia and Herzegovina",
            websites: "[PERSONAL:https://amina.dev,PORTFOLIO:https://github.com/aminak]",
        },
        positions: [
            {
                companyName: "EngineWorks",
                title: "Senior Software Engineer",
                description: "Own the resume editor.",
                location: "Sarajevo",
                startedOn: "Feb 2022",
                finishedOn: "",
            },
            {
                companyName: "WebShop d.o.o.",
                title: "Frontend Developer",
                description: "Storefront features.",
                location: "Remote",
                startedOn: "Jan 2019",
                finishedOn: "Dec 2021",
            },
        ],
        education: [
            {
                schoolName: "University of Sarajevo",
                degreeName: "Bachelor of Science, Computer Science",
                startDate: "Sep 2014",
                endDate: "Jun 2018",
                notes: "Thesis on distributed systems.",
                activities: "ACM student chapter",
            },
        ],
        skills: [{ name: "TypeScript" }, { name: "React" }],
        certifications: [
            {
                name: "AWS Certified Developer",
                authority: "Amazon Web Services",
                url: "https://aws.amazon.com/verification",
                startedOn: "Mar 2022",
                finishedOn: "Mar 2025",
                licenseNumber: "ABC-123",
            },
        ],
        languages: [{ name: "Bosnian", proficiency: "Native or bilingual proficiency" }],
        projects: [
            {
                title: "EngineCV",
                description: "Local-first resume builder.",
                url: "https://enginecv.example",
                startedOn: "2023",
                finishedOn: "",
            },
        ],
        filesFound: ["profile", "positions", "education", "skills", "certifications", "languages", "projects"],
    });

describe("mapLinkedinToResume", () => {
    it("produces a resume that passes schema validation", () => {
        expect(() => resumeSchema.parse(mapLinkedinToResume(fullParsed()))).not.toThrow();
    });

    it("maps profile fields to basics", () => {
        const resume = mapLinkedinToResume(fullParsed());
        expect(resume.basics.name).toBe("Amina Kovačević");
        expect(resume.basics.headline).toBe("Senior Software Engineer");
        expect(resume.basics.summary).toBe("Builder of local-first tools.");
        expect(resume.basics.location).toBe("Sarajevo, Bosnia and Herzegovina");
        expect(resume.basics.website).toBe("https://amina.dev");
    });

    it("maps positions to experience with current role as empty end", () => {
        const resume = mapLinkedinToResume(fullParsed());
        expect(resume.experience).toHaveLength(2);
        expect(resume.experience[0].company).toBe("EngineWorks");
        expect(resume.experience[0].position).toBe("Senior Software Engineer");
        expect(resume.experience[0].start).toBe("2022-02");
        expect(resume.experience[0].end).toBe("");
        expect(resume.experience[1].start).toBe("2019-01");
        expect(resume.experience[1].end).toBe("2021-12");
    });

    it("splits degree name on the first comma into studyType and area", () => {
        const resume = mapLinkedinToResume(fullParsed());
        expect(resume.education[0].institution).toBe("University of Sarajevo");
        expect(resume.education[0].studyType).toBe("Bachelor of Science");
        expect(resume.education[0].area).toBe("Computer Science");
        expect(resume.education[0].description).toContain("Thesis on distributed systems.");
        expect(resume.education[0].description).toContain("ACM student chapter");
    });

    it("keeps an unsplittable degree name entirely in studyType", () => {
        const parsed = fullParsed();
        parsed.education[0].degreeName = "Diplom-Ingenieur";
        const resume = mapLinkedinToResume(parsed);
        expect(resume.education[0].studyType).toBe("Diplom-Ingenieur");
        expect(resume.education[0].area).toBe("");
    });

    it("maps skills without invented proficiency levels", () => {
        const resume = mapLinkedinToResume(fullParsed());
        expect(resume.skillGroups[0].skills.map((skill) => skill.name)).toEqual(["TypeScript", "React"]);
        expect(resume.skillGroups[0].skills[0].level).toBe("");
        expect(resume.skillGroups[0].skills[0].display).toBe("both");
    });

    it("maps certifications with authority, date, and license in the description", () => {
        const resume = mapLinkedinToResume(fullParsed());
        expect(resume.certificates[0].name).toBe("AWS Certified Developer");
        expect(resume.certificates[0].issuer).toBe("Amazon Web Services");
        expect(resume.certificates[0].date).toBe("2022-03");
        expect(resume.certificates[0].url).toBe("https://aws.amazon.com/verification");
        expect(resume.certificates[0].description).toContain("ABC-123");
    });

    it("maps languages with the export's proficiency string as fluency", () => {
        const resume = mapLinkedinToResume(fullParsed());
        expect(resume.languages[0].language).toBe("Bosnian");
        expect(resume.languages[0].fluency).toBe("Native or bilingual proficiency");
        expect(resume.languages[0].assessmentType).toBe("none");
    });

    it("maps projects with year-only start dates", () => {
        const resume = mapLinkedinToResume(fullParsed());
        expect(resume.projects[0].name).toBe("EngineCV");
        expect(resume.projects[0].start).toBe("2023");
        expect(resume.projects[0].end).toBe("");
        expect(resume.projects[0].url).toBe("https://enginecv.example");
    });

    it("assigns unique linkedin-prefixed ids for duplicate names", () => {
        const parsed = emptyParsed({
            skills: [{ name: "React" }, { name: "React" }],
        });
        const resume = mapLinkedinToResume(parsed);
        expect(resume.skillGroups[0].skills[0].id).toBe("linkedin-skill-react");
        expect(resume.skillGroups[0].skills[1].id).toBe("linkedin-skill-react-2");
    });

    it("lists only non-empty sections in contentSections", () => {
        const parsed = emptyParsed({
            skills: [{ name: "React" }],
            positions: [
                {
                    companyName: "EngineWorks",
                    title: "Engineer",
                    description: "",
                    location: "",
                    startedOn: "",
                    finishedOn: "",
                },
            ],
        });
        const resume = mapLinkedinToResume(parsed);
        expect(resume.settings.contentSections).toEqual(["experience", "skills"]);
    });

    it("titles the resume after the person with a LinkedIn-import suffix", () => {
        expect(mapLinkedinToResume(fullParsed()).meta.title).toBe("Amina Kovačević — LinkedIn import");
    });

    it("falls back to a generic title without a profile", () => {
        const resume = mapLinkedinToResume(emptyParsed({ skills: [{ name: "React" }] }));
        expect(resume.meta.title).toBe("LinkedIn import");
        expect(resume.basics.name).toBe("");
    });

    it("handles a profile with no parsable website", () => {
        const parsed = fullParsed();
        parsed.profile!.websites = "";
        expect(mapLinkedinToResume(parsed).basics.website).toBe("");
    });
});
