import { describe, expect, it } from "vitest";
import { resumeSchema } from "@/lib/schema";
import type { Notice } from "./notices";
import { AUTHORING_FORMAT } from "./schema";
import { authoringToResume, titleFromKey } from "./to-resume";

const doc = (rest: Record<string, unknown>) => ({ format: AUTHORING_FORMAT, ...rest });
const pick = (notices: Notice[]) => notices.map(({ kind, code, path }) => ({ kind, code, path }));

describe("authoringToResume", () => {
    it("turns a name-only document into a valid resume with no notices", () => {
        const result = authoringToResume(doc({ basics: { name: "Amina" } }), { now: 1 });
        expect(() => resumeSchema.parse(result.resume)).not.toThrow();
        expect(result.resume.basics.name).toBe("Amina");
        expect(result.resume.meta.title).toBe("Amina");
        expect(result.resume.createdAt).toBe(1);
        expect(result.resume.id).toBeUndefined();
        expect(result.notices).toEqual([]);
        expect(Object.values(result.counts).every((count) => count === 0)).toBe(true);
    });

    it("never throws, whatever it is given", () => {
        for (const input of [null, 42, "text", [], { experience: "nope" }, { basics: [], skills: 3, languages: {} }]) {
            const result = authoringToResume(input);
            expect(() => resumeSchema.parse(result.resume)).not.toThrow();
        }
    });

    it("maps the contract example and counts each section", () => {
        const result = authoringToResume(doc({
            basics: { name: "Amina Hodžić", email: "amina@example.com", linkedin: "https://www.linkedin.com/in/amina" },
            summary: "Registered nurse with **6 years** in intensive care.",
            experience: [{
                id: "x7f3", position: "Medicinska sestra, ICU", company: "KCUS", location: "Sarajevo",
                start: "2019-03", end: "present", highlights: ["Ventilated patients, 1:2 ratio", "Trained 8 new nurses"],
            }],
            education: [{ institution: "Univerzitet u Sarajevu", studyType: "Bachelor", area: "Nursing", end: "2018" }],
            skills: { Clinical: ["Intensive care", { name: "Wound care", level: "expert" }], Tools: ["SAP IS-H"] },
            languages: ["Bosnian: native", "German: B2", "English: B1"],
        }));
        const { resume, counts, notices } = result;
        expect(notices).toEqual([]);
        expect(resume.basics.summary).toContain("**6 years**");
        expect(resume.basics.emails.map((entry) => entry.email)).toEqual(["amina@example.com"]);
        expect(resume.experience[0]).toMatchObject({ id: "x7f3", end: "Present", start: "2019-03" });
        expect(resume.skillGroups.map((group) => group.name)).toEqual(["", "Clinical", "Tools"]);
        expect(resume.skillGroups[1].skills[1]).toMatchObject({ name: "Wound care", level: "expert" });
        expect(resume.languages.map((language) => language.fluency)).toEqual(["Native", "B2", "B1"]);
        expect(counts).toMatchObject({ experience: 1, education: 1, skills: 3, languages: 3, courses: 0 });
        expect(resume.settings.contentSections).toEqual(["experience", "education", "skills", "languages"]);
    });

    it("turns an unknown top-level key into a custom section", () => {
        const result = authoringToResume(doc({
            openSource: ["tracepipe", "kvbench"],
            volunteerWork: [{ name: "Mentor", company: "Code for BiH", from: "2021" }],
            motto: "Ship it.",
        }));
        expect(result.resume.customSections.map(({ title, layout }) => ({ title, layout }))).toEqual([
            { title: "Open source", layout: "tags" },
            { title: "Volunteer work", layout: "entries" },
            { title: "Motto", layout: "text" },
        ]);
        expect(result.resume.customSections[1].entries[0]).toMatchObject({ title: "Mentor", subtitle: "Code for BiH", start: "2021" });
        expect(pick(result.notices).filter((notice) => notice.code === "unknown-key-to-custom")).toEqual([
            { kind: "adjusted", code: "unknown-key-to-custom", path: "openSource" },
            { kind: "adjusted", code: "unknown-key-to-custom", path: "volunteerWork" },
            { kind: "adjusted", code: "unknown-key-to-custom", path: "motto" },
        ]);
        expect(result.resume.settings.contentSections).toEqual(
            result.resume.customSections.map((section) => `custom:${section.id}`));
    });

    it("appends unknown entry fields to the description", () => {
        const result = authoringToResume(doc({
            experience: [{ position: "Nurse", description: "Ward work.", team: "ICU", shifts: ["night", "weekend"] }],
        }));
        expect(result.resume.experience[0].description).toBe("Ward work.\n\nteam: ICU\nshifts: night, weekend");
        expect(pick(result.notices)).toEqual([
            { kind: "adjusted", code: "unknown-field-to-description", path: "experience[0].team" },
            { kind: "adjusted", code: "unknown-field-to-description", path: "experience[0].shifts" },
        ]);
    });

    it("renames section and field synonyms with a notice", () => {
        const result = authoringToResume(doc({
            work: [{ title: "Engineer", employer: "Acme", startDate: "2020-01" }],
            certifications: [{ name: "CKA" }],
            volunteering: [{ organization: "Red Cross", position: "Volunteer" }],
            hobbies: ["Chess"],
        }));
        expect(result.resume.experience[0]).toMatchObject({ position: "Engineer", company: "Acme", start: "2020-01" });
        expect(result.resume.certificates[0].name).toBe("CKA");
        expect(result.resume.organisations[0]).toMatchObject({ name: "Red Cross", role: "Volunteer" });
        expect(result.resume.interests[0].name).toBe("Chess");
        const renamed = pick(result.notices).filter((notice) => notice.code === "section-renamed").map((notice) => notice.path);
        expect(renamed).toEqual(["work", "certifications", "volunteering", "hobbies"]);
        const fields = pick(result.notices).filter((notice) => notice.code === "field-renamed").map((notice) => notice.path);
        expect(fields).toEqual([
            "work[0].title", "work[0].employer", "work[0].startDate",
            "volunteering[0].organization", "volunteering[0].position",
        ]);
    });

    it("keeps valid ids and regenerates duplicate or malformed ones", () => {
        const result = authoringToResume(doc({
            experience: [{ id: "a", position: "1" }, { id: "a", position: "2" }, { id: "has space", position: "3" }, { position: "4" }],
        }));
        const ids = result.resume.experience.map((entry) => entry.id);
        expect(ids[0]).toBe("a");
        expect(new Set(ids).size).toBe(4);
        expect(pick(result.notices)).toEqual([
            { kind: "adjusted", code: "id-regenerated", path: "experience[1].id" },
            { kind: "adjusted", code: "id-regenerated", path: "experience[2].id" },
        ]);
    });

    it("ignores photos", () => {
        const result = authoringToResume(doc({ photo: "data:image/png;base64,AAA", basics: { name: "A", image: "https://x.example/a.png" } }));
        expect(result.resume.basics.photo).toBe("");
        expect(pick(result.notices)).toEqual([
            { kind: "skipped", code: "photo-ignored", path: "photo" },
            { kind: "skipped", code: "photo-ignored", path: "basics.image" },
        ]);
    });

    it("applies known design hints and ignores unknown ones with notices", () => {
        const applied = authoringToResume(doc({ design: { template: "enginecv-modern", accent: "#1f3a5f", cvLanguage: "de" } }));
        expect(applied.designApplied).toEqual({ template: "enginecv-modern", accent: "#1f3a5f", cvLanguage: "de" });
        expect(applied.resume.settings.colors.accent).toBe("#1f3a5f");
        expect(applied.resume.settings.language).toBe("de");
        expect(applied.notices).toEqual([]);

        const ignored = authoringToResume(doc({ design: { template: "fancy", accent: "blue", cvLanguage: "xx", font: "Comic" } }));
        expect(ignored.designApplied).toEqual({});
        expect(pick(ignored.notices).map((notice) => notice.code).sort()).toEqual(
            ["accent-invalid", "cv-language-unknown", "design-hint-unknown", "template-unknown"]);
    });

    it("flags a missing, unknown or newer format marker", () => {
        expect(pick(authoringToResume({ basics: { name: "A" } }).notices)).toEqual([
            { kind: "review", code: "format-missing", path: "(document)" },
        ]);
        expect(pick(authoringToResume({ format: "enginecv.authoring/v2" }).notices)).toEqual([
            { kind: "review", code: "newer-version", path: "format" },
        ]);
        expect(pick(authoringToResume({ format: "jsonresume" }).notices)[0].code).toBe("format-unknown");
    });

    it("reads every accepted alternative form", () => {
        const { resume, notices } = authoringToResume(doc({
            basics: {
                name: "A",
                email: [{ email: "w@example.com", label: "Work" }, "p@example.com"],
                website: "amina.example.com",
                links: [{ name: "Blog", url: "blog.example.com" }],
            },
            experience: [{ position: "P", start: "March 2021", end: "heute", highlights: "- One\n- Two", skills: "Go, Rust" }],
            skills: ["TypeScript (expert)", { name: "Go", level: "Advanced" }],
            languages: ["German (C1)", { language: "English", cefr: { listening: "c1", reading: "B2", writing: "B2" } }],
            interests: [{ name: "Chess", description: "Club play." }, "Running"],
            declaration: { text: "True.", place: "Sarajevo" },
            custom: [{ title: "Tools", tags: ["Vim"] }, { title: "Statement", text: "Hi" }],
        }));
        expect(resume.basics.emails.map(({ email, label }) => ({ email, label }))).toEqual([
            { email: "w@example.com", label: "Work" }, { email: "p@example.com", label: "" },
        ]);
        expect(resume.basics.email).toBe("w@example.com");
        expect(resume.basics.website).toBe("https://amina.example.com");
        expect(resume.basics.customLinks[0]).toMatchObject({ name: "Blog", url: "https://blog.example.com" });
        expect(resume.experience[0]).toMatchObject({
            start: "2021-03", end: "Present", highlights: ["One", "Two"], skills: ["Go", "Rust"],
        });
        expect(resume.skillGroups[0].skills.map(({ name, level }) => ({ name, level }))).toEqual([
            { name: "TypeScript", level: "expert" }, { name: "Go", level: "proficient" },
        ]);
        expect(resume.languages[0]).toMatchObject({ language: "German", fluency: "C1" });
        expect(resume.languages[1]).toMatchObject({
            language: "English", fluency: "B2", cefrDetailed: true,
            cefr: { listening: "C1", reading: "B2", writing: "B2", spokenInteraction: "", spokenProduction: "" },
        });
        expect(resume.interests.map((interest) => interest.name)).toEqual(["Chess", "Running"]);
        expect(resume.declaration[0]).toMatchObject({ text: "True.", place: "Sarajevo" });
        expect(resume.customSections.map((section) => section.layout)).toEqual(["tags", "text"]);

        // Every value that was not taken as written has exactly one notice.
        expect(pick(notices).map((notice) => `${notice.path} ${notice.code}`)).toEqual([
            "basics.website link-normalised",
            "basics.links[0].url link-normalised",
            "experience[0].start date-normalised",
            "experience[0].end date-normalised",
            "experience[0].highlights highlights-split",
            "experience[0].skills list-split",
            "skills[0] skill-normalised",
            "skills[1].level skill-normalised",
            "languages[0] language-normalised",
            "languages[1].cefr.listening language-normalised",
        ]);
    });

    it("drops what it cannot use, with a notice, without blocking the rest", () => {
        const { resume, notices } = authoringToResume(doc({
            basics: { name: "A", email: "not-an-email", favouriteColour: "blue" },
            experience: ["just text", { position: "Kept", start: "spring 2021", hidden: "yes" }],
            references: [{ name: "R", email: "nope" }],
            skills: [{ name: "Go", level: "9/10" }, ""],
        }));
        expect(resume.basics.email).toBe("");
        expect(resume.experience).toHaveLength(1);
        expect(resume.experience[0]).toMatchObject({ position: "Kept", start: "", hidden: false });
        expect(resume.references[0].email).toBe("");
        expect(resume.skillGroups[0].skills.map((skill) => skill.level)).toEqual([""]);
        expect(pick(notices).map((notice) => `${notice.path} ${notice.kind} ${notice.code}`)).toEqual([
            "basics.favouriteColour skipped unknown-field-skipped",
            "basics.email skipped email-invalid",
            "experience[0] skipped entry-invalid",
            "experience[1].start skipped date-unparsed",
            "experience[1].hidden skipped value-invalid",
            "references[0].email skipped email-invalid",
            "skills[0].level skipped skill-level-unknown",
            "skills[1] skipped entry-invalid",
        ]);
    });

    it("keeps an explicit unnamed group apart from the ungrouped skills", () => {
        const { resume } = authoringToResume(doc({
            skills: ["Loose", { group: "", skills: ["Grouped"] }, { skills: ["Also loose"] }],
        }));
        expect(resume.skillGroups.map((group) => [group.name, group.skills.map((skill) => skill.name)])).toEqual([
            ["", ["Loose", "Also loose"]],
            ["", ["Grouped"]],
        ]);
        expect(resume.skillGroups[1].id).not.toBe("ungrouped");
    });

    it("keeps unknown language levels as text for review", () => {
        const { resume, notices } = authoringToResume(doc({ languages: ["Italian: fluent"] }));
        expect(resume.languages[0].fluency).toBe("fluent");
        expect(pick(notices)).toEqual([{ kind: "review", code: "language-level-unrecognised", path: "languages[0]" }]);
    });

    it("titles custom sections from keys", () => {
        expect(titleFromKey("open_source")).toBe("Open source");
        expect(titleFromKey("speakingEngagements")).toBe("Speaking engagements");
    });
});
