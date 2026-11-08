import { describe, expect, it } from "vitest";
import { createEmptyResume, isNativeLanguageFluency, normalizeSkillGroups, resumeSchema, skillSchema, UNGROUPED_SKILL_GROUP_ID } from "./schema";

describe("resumeSchema", () => {
    it("recognizes native and bilingual-native proficiency labels", () => {
        expect(isNativeLanguageFluency("Native")).toBe(true);
        expect(isNativeLanguageFluency("Native or bilingual proficiency")).toBe(true);
        expect(isNativeLanguageFluency("C2")).toBe(false);
    });

    it("creates an empty resume with nested defaults", () => {
        const resume = createEmptyResume();

        expect(resume.basics.name).toBe("");
        expect(resume.basics.photoEdit).toBeNull();
        expect(resume.meta).toEqual({
            title: "",
            description: "",
            tags: [],
        });
        expect(resume.interests).toEqual([]);
        expect(resume.settings.measurementSystem).toBe("metric");
        expect(resume.settings.layout.columns).toBe("one");
        expect(resume.settings.personalDetails).toEqual({
            alignment: "left",
            layout: "imageRight",
            detailsLayout: "wrap",
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            paddingRight: 0,
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            border: {
                style: "solid",
                width: 0,
                color: "",
                radius: 0,
                top: false,
                bottom: false,
                left: false,
                right: false,
                dashLength: 6,
                dashGap: 4,
            },
            photo: {
                width: 96,
                height: 96,
                paddingTop: 0,
                paddingBottom: 0,
                paddingLeft: 0,
                paddingRight: 0,
                marginTop: 0,
                marginBottom: 0,
                marginLeft: 0,
                marginRight: 0,
                border: {
                    style: "solid",
                    width: 1,
                    color: "",
                    radius: 18,
                    top: true,
                    bottom: true,
                    left: true,
                    right: true,
                    dashLength: 6,
                    dashGap: 4,
                },
                filter: {
                    preset: "natural",
                    brightness: 100,
                    contrast: 100,
                    saturate: 100,
                    grayscale: 0,
                    sepia: 0,
                    hueRotate: 0,
                    blur: 0,
                },
            },
        });
        expect(resume.settings.contentStyle).toEqual({
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            paddingRight: 0,
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            border: {
                style: "solid",
                width: 0,
                color: "",
                radius: 0,
                top: false,
                bottom: false,
                left: false,
                right: false,
                dashLength: 6,
                dashGap: 4,
            },
            backgroundColor: "",
            preset: "plain",
        });
        expect(resume.settings.design).toEqual({
            elements: [],
        });
        expect(resume.settings.headings).toMatchObject({
            marginTop: 0,
            marginBottom: 16,
            marginLeft: 0,
            marginRight: 0,
        });
        expect(resume.settings.layout.sectionOrder).toEqual([
            "experience",
            "education",
            "certificates",
            "projects",
            "skills",
            "languages",
        ]);
        expect(resume.settings.colors).toMatchObject({
            accent: "#ffaa8d",
            text: "#111827",
            background: "#fff8f6",
        });
        expect(typeof resume.createdAt).toBe("number");
        expect(typeof resume.updatedAt).toBe("number");
    });

    it("backfills nested defaults when parsing a partial resume payload", () => {
        const parsed = resumeSchema.parse({
            basics: {
                name: "Jane Doe",
            },
            settings: {
                measurementSystem: "imperial",
                colors: {
                    accent: "#123456",
                },
            },
        });

        expect(parsed.basics.name).toBe("Jane Doe");
        expect(parsed.meta).toEqual({
            title: "",
            description: "",
            tags: [],
        });
        expect(parsed.interests).toEqual([]);
        expect(parsed.basics.photoEdit).toBeNull();
        expect(parsed.settings.measurementSystem).toBe("imperial");
        expect(parsed.settings.colors.accent).toBe("#123456");
        expect(parsed.settings.colors.text).toBe("#111827");
        expect(parsed.settings.spacing.marginH).toBe(20);
        expect(parsed.settings.header.fontSize).toBe(36);
        expect(parsed.settings.personalDetails).toEqual({
            alignment: "left",
            layout: "imageRight",
            detailsLayout: "wrap",
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            paddingRight: 0,
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            border: {
                style: "solid",
                width: 0,
                color: "",
                radius: 0,
                top: false,
                bottom: false,
                left: false,
                right: false,
                dashLength: 6,
                dashGap: 4,
            },
            photo: {
                width: 96,
                height: 96,
                paddingTop: 0,
                paddingBottom: 0,
                paddingLeft: 0,
                paddingRight: 0,
                marginTop: 0,
                marginBottom: 0,
                marginLeft: 0,
                marginRight: 0,
                border: {
                    style: "solid",
                    width: 1,
                    color: "",
                    radius: 18,
                    top: true,
                    bottom: true,
                    left: true,
                    right: true,
                    dashLength: 6,
                    dashGap: 4,
                },
                filter: {
                    preset: "natural",
                    brightness: 100,
                    contrast: 100,
                    saturate: 100,
                    grayscale: 0,
                    sepia: 0,
                    hueRotate: 0,
                    blur: 0,
                },
            },
        });
        expect(parsed.settings.headings).toMatchObject({
            marginTop: 0,
            marginBottom: 16,
            marginLeft: 0,
            marginRight: 0,
        });
        expect(parsed.settings.contentStyle).toEqual({
            paddingTop: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            paddingRight: 0,
            marginTop: 0,
            marginBottom: 0,
            marginLeft: 0,
            marginRight: 0,
            border: {
                style: "solid",
                width: 0,
                color: "",
                radius: 0,
                top: false,
                bottom: false,
                left: false,
                right: false,
                dashLength: 6,
                dashGap: 4,
            },
            backgroundColor: "",
            preset: "plain",
        });
        expect(parsed.settings.design).toEqual({
            elements: [],
        });
    });

    it("backfills photo rotation for existing saved photo edit payloads", () => {
        const parsed = resumeSchema.parse({
            basics: {
                photoEdit: {
                    original: "data:image/png;base64,test",
                    crop: { x: 12, y: -4 },
                    zoom: 1.4,
                    croppedAreaPixels: { x: 10, y: 20, width: 200, height: 200 },
                },
            },
        });

        expect(parsed.basics.photoEdit).toMatchObject({
            original: "data:image/png;base64,test",
            rotation: 0,
            crop: { x: 12, y: -4 },
            zoom: 1.4,
            croppedAreaPixels: { x: 10, y: 20, width: 200, height: 200 },
        });
    });

    it("rejects invalid structured contact values", () => {
        const result = resumeSchema.safeParse({
            basics: {
                email: "not-an-email",
            },
        });

        expect(result.success).toBe(false);
    });

    it("migrates a legacy email into the labeled email list", () => {
        const parsed = resumeSchema.parse({
            basics: {
                email: "jane@example.com",
            },
        });

        expect(parsed.basics.email).toBe("jane@example.com");
        expect(parsed.basics.emails).toEqual([
            expect.objectContaining({
                email: "jane@example.com",
                label: "",
            }),
        ]);
    });

    it("keeps multiple labeled emails and synchronizes the primary alias", () => {
        const parsed = resumeSchema.parse({
            basics: {
                email: "stale@example.com",
                emails: [
                    { id: "email-main", email: "main@example.com", label: "Primary" },
                    { id: "email-personal", email: "personal@example.com", label: "Personal" },
                ],
            },
        });

        expect(parsed.basics.email).toBe("main@example.com");
        expect(parsed.basics.emails).toEqual([
            { id: "email-main", email: "main@example.com", label: "Primary" },
            { id: "email-personal", email: "personal@example.com", label: "Personal" },
        ]);
    });

    it("rejects an invalid email inside the labeled email list", () => {
        const result = resumeSchema.safeParse({
            basics: {
                emails: [{ id: "email-main", email: "not-an-email", label: "Primary" }],
            },
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.path).toEqual(["basics", "emails", 0, "email"]);
        }
    });

    it("accepts human-entered link fields for JSON round trips", () => {
        const parsed = resumeSchema.parse({
            basics: {
                website: "portfolio.example",
                linkedin: "linkedin.com/in/janedoe",
                github: "github.com/janedoe",
                customLinks: [
                    {
                        id: "custom-link-1",
                        name: "Portfolio",
                        url: "portfolio",
                        label: "Portfolio",
                        icon: "auto",
                    },
                ],
            },
            experience: [{ id: "exp-1", company: "Acme", url: "acme.example" }],
            education: [{ id: "edu-1", institution: "Example University", url: "example.edu" }],
            projects: [{ id: "project-1", name: "Project", url: "github.com/janedoe/project" }],
            certificates: [{ id: "cert-1", name: "Certificate", issuer: "Issuer", url: "freeCodeCamp", issuerUrl: "issuer" }],
            jobContext: { company: "Acme", role: "Engineer", url: "careers.example/job" },
        });

        expect(parsed.basics.github).toBe("github.com/janedoe");
        expect(parsed.certificates[0].url).toBe("freeCodeCamp");
        expect(parsed.jobContext?.url).toBe("careers.example/job");
    });

    it("accepts custom meta title and description", () => {
        const parsed = resumeSchema.parse({
            meta: {
                title: "Senior Backend Engineer Resume",
                description: "Focused on distributed systems and platform work.",
            },
        });

        expect(parsed.meta.title).toBe("Senior Backend Engineer Resume");
        expect(parsed.meta.description).toBe("Focused on distributed systems and platform work.");
    });

    it("accepts interests with markdown details", () => {
        const parsed = resumeSchema.parse({
            interests: [
                {
                    id: "interest-1",
                    name: "Open-source communities",
                    description: "**Maintainer** for accessibility tooling.",
                },
            ],
        });

        expect(parsed.interests).toEqual([
            {
                id: "interest-1",
                hidden: false,
                name: "Open-source communities",
                description: "**Maintainer** for accessibility tooling.",
            },
        ]);
    });

    it("accepts standardized language entries and backfills legacy language defaults", () => {
        const parsed = resumeSchema.parse({
            languages: [
                {
                    id: "language-1",
                    language: "English",
                    fluency: "C1",
                    assessmentType: "issuer",
                    issuer: "IELTS",
                    assessmentId: "TRF-12345",
                    assessmentUrl: "https://ielts.org/verify/TRF-12345",
                    description: "**Academic** certification.",
                },
                {
                    id: "language-2",
                    language: "Bosnian",
                    fluency: "Native",
                },
            ],
            settings: {
                sectionDisplay: {
                    languages: {
                        languageLayout: "table",
                    },
                },
            },
        });

        expect(parsed.languages[0]).toEqual({
            id: "language-1",
            hidden: false,
            language: "English",
            fluency: "C1",
            cefrDetailed: false,
            cefr: { listening: "", reading: "", spokenInteraction: "", spokenProduction: "", writing: "" },
            assessmentType: "issuer",
            issuer: "IELTS",
            assessmentId: "TRF-12345",
            assessmentUrl: "https://ielts.org/verify/TRF-12345",
            description: "**Academic** certification.",
        });
        expect(parsed.languages[1]).toMatchObject({
            id: "language-2",
            language: "Bosnian",
            fluency: "Native",
            assessmentType: "none",
            issuer: "",
            assessmentId: "",
            assessmentUrl: "",
            description: "",
        });
        expect(parsed.settings.sectionDisplay.languages?.languageLayout).toBe("table");
    });

    it("defaults languagesSection styling so pre-feature documents keep the current look", () => {
        const parsed = resumeSchema.parse({});

        expect(parsed.settings.languagesSection).toEqual({
            columns: 1,
            columnGap: 16,
            itemSpacing: null,
            fluencyDisplay: "badge",
            fluencySize: 0.85,
            fluencyPlacement: "nextLine",
            fluencyOrder: "languageFirst",
            textAlign: "left",
            tableCellPaddingX: 8,
            tableCellPaddingY: 6,
        });
    });

    it("accepts custom languagesSection styling values", () => {
        const parsed = resumeSchema.parse({
            settings: {
                languagesSection: {
                    columns: 2,
                    columnGap: 24,
                    itemSpacing: 4,
                    fluencyDisplay: "hidden",
                    fluencySize: 1,
                    fluencyPlacement: "sameLine",
                    fluencyOrder: "fluencyFirst",
                    textAlign: "center",
                    tableCellPaddingX: 12,
                    tableCellPaddingY: 10,
                },
            },
        });

        expect(parsed.settings.languagesSection).toEqual({
            columns: 2,
            columnGap: 24,
            itemSpacing: 4,
            fluencyDisplay: "hidden",
            fluencySize: 1,
            fluencyPlacement: "sameLine",
            fluencyOrder: "fluencyFirst",
            textAlign: "center",
            tableCellPaddingX: 12,
            tableCellPaddingY: 10,
        });
    });

    it("defaults visibility fields so pre-feature documents load fully visible", () => {
        const parsed = resumeSchema.parse({
            experience: [{ id: "exp-1", company: "Acme" }],
            education: [{ id: "edu-1", institution: "Uni" }],
            certificates: [{ id: "cert-1", name: "Cert" }],
            projects: [{ id: "proj-1", name: "Proj" }],
            skills: [{ id: "skill-1", name: "TypeScript" }],
            languages: [{ id: "lang-1", language: "English" }],
            organisations: [{ id: "org-1", name: "Org" }],
            courses: [{ id: "course-1", name: "Course" }],
            awards: [{ id: "award-1", name: "Award" }],
            interests: [{ id: "int-1", name: "Chess" }],
        });

        expect(parsed.experience[0].hidden).toBe(false);
        expect(parsed.education[0].hidden).toBe(false);
        expect(parsed.certificates[0].hidden).toBe(false);
        expect(parsed.projects[0].hidden).toBe(false);
        expect(parsed.skillGroups[0].skills[0].hidden).toBe(false);
        expect(parsed.languages[0].hidden).toBe(false);
        expect(parsed.organisations[0].hidden).toBe(false);
        expect(parsed.courses[0].hidden).toBe(false);
        expect(parsed.awards[0].hidden).toBe(false);
        expect(parsed.interests[0].hidden).toBe(false);
        expect(parsed.settings.hiddenSections).toEqual([]);
        expect(createEmptyResume().settings.hiddenSections).toEqual([]);
    });

    it("round-trips visibility fields through parse", () => {
        const parsed = resumeSchema.parse({
            experience: [{ id: "exp-1", company: "Acme", hidden: true }],
            skills: [{ id: "skill-1", name: "Go", hidden: true }],
            settings: {
                contentSections: ["experience", "skills"],
                hiddenSections: ["skills"],
            },
        });

        expect(parsed.experience[0].hidden).toBe(true);
        expect(parsed.skillGroups[0].skills[0].hidden).toBe(true);
        expect(parsed.settings.hiddenSections).toEqual(["skills"]);

        const reparsed = resumeSchema.parse(JSON.parse(JSON.stringify(parsed)));
        expect(reparsed.experience[0].hidden).toBe(true);
        expect(reparsed.settings.hiddenSections).toEqual(["skills"]);
    });

    it("accepts persisted design overlay elements", () => {
        const parsed = resumeSchema.parse({
            settings: {
                design: {
                    elements: [
                        {
                            id: "design-1",
                            type: "text",
                            placement: "overlay",
                            pageIndex: 0,
                            x: 64,
                            y: 72,
                            width: 240,
                            height: 96,
                            zIndex: 1,
                            text: "Overlay headline",
                            imageSrc: "",
                            shape: "rectangle",
                            style: {
                                opacity: 88,
                                color: "#112233",
                                backgroundColor: "",
                                fillMode: "gradient",
                                gradientFrom: "#ffaa8d",
                                gradientTo: "#ffffff",
                                gradientAngle: 120,
                                fontFamily: "",
                                fontSize: 24,
                                fontWeight: "800",
                                fontStyle: "normal",
                                textDecoration: "none",
                                textTransform: "uppercase",
                                lineHeight: 1.1,
                                letterSpacing: 1,
                                textAlign: "center",
                                objectFit: "cover",
                                paddingTop: 8,
                                paddingBottom: 8,
                                paddingLeft: 12,
                                paddingRight: 12,
                                marginTop: 0,
                                marginBottom: 0,
                                marginLeft: 0,
                                marginRight: 0,
                                border: {
                                    style: "solid",
                                    width: 1,
                                    color: "#112233",
                                    radius: 12,
                                    top: true,
                                    bottom: true,
                                    left: true,
                                    right: true,
                                    dashLength: 6,
                                    dashGap: 4,
                                },
                            },
                        },
                    ],
                },
            },
        });

        expect(parsed.settings.design.elements).toHaveLength(1);
        expect(parsed.settings.design.elements[0]).toMatchObject({
            type: "text",
            placement: "overlay",
            text: "Overlay headline",
            style: {
                fillMode: "gradient",
                gradientAngle: 120,
                fontSize: 24,
            },
        });
    });
});

describe("skill groups", () => {
    it("defaults new skills to icon and name display", () => {
        expect(skillSchema.parse({ name: "TypeScript" }).display).toBe("both");
    });

    it("migrates a legacy flat skills array into the Non-group", () => {
        const parsed = resumeSchema.parse({
            skills: [{ id: "skill-1", name: "TypeScript" }],
        });

        expect(parsed.skillGroups[0].id).toBe(UNGROUPED_SKILL_GROUP_ID);
        expect(parsed.skillGroups[0].skills.map((s) => s.name)).toEqual(["TypeScript"]);
    });

    it("migrates legacy per-skill group labels into named groups", () => {
        const parsed = resumeSchema.parse({
            skills: [
                { id: "s1", name: "Git" },
                { id: "s2", name: "C", group: "Programming Languages" },
                { id: "s3", name: "React", group: "libraries" },
                { id: "s4", name: "C++", group: "programming languages" },
            ],
        });

        expect(parsed.skillGroups[0].id).toBe(UNGROUPED_SKILL_GROUP_ID);
        expect(parsed.skillGroups[0].skills.map((s) => s.name)).toEqual(["Git"]);
        expect(parsed.skillGroups.slice(1).map((g) => g.name)).toEqual(["Programming Languages", "libraries"]);
        expect(parsed.skillGroups[1].skills.map((s) => s.name)).toEqual(["C", "C++"]);
    });

    it("creates an empty Non-group by default", () => {
        const resume = createEmptyResume();
        expect(resume.skillGroups).toHaveLength(1);
        expect(resume.skillGroups[0].id).toBe(UNGROUPED_SKILL_GROUP_ID);
        expect(resume.skillGroups[0].skills).toEqual([]);
    });

    it("normalizeSkillGroups pins a single Non-group first and merges duplicates", () => {
        const named = { id: "g1", name: "Frameworks", hidden: false, skills: [skillSchema.parse({ name: "FastAPI" })] };
        const stray1 = { id: UNGROUPED_SKILL_GROUP_ID, name: "", hidden: false, skills: [skillSchema.parse({ name: "Git" })] };
        const stray2 = { id: UNGROUPED_SKILL_GROUP_ID, name: "", hidden: false, skills: [skillSchema.parse({ name: "Bash" })] };

        const normalized = normalizeSkillGroups([named, stray1, stray2]);

        expect(normalized[0].id).toBe(UNGROUPED_SKILL_GROUP_ID);
        expect(normalized[0].skills.map((s) => s.name)).toEqual(["Git", "Bash"]);
        expect(normalized[1]).toBe(named);
        expect(normalized).toHaveLength(2);
    });

    it("keeps skillGroups untouched when already in the new shape", () => {
        const parsed = resumeSchema.parse({
            skillGroups: [
                { id: UNGROUPED_SKILL_GROUP_ID, name: "", hidden: false, skills: [] },
                { id: "g1", name: "Languages", hidden: true, skills: [{ name: "C" }] },
            ],
        });

        expect(parsed.skillGroups).toHaveLength(2);
        expect(parsed.skillGroups[1].hidden).toBe(true);
        expect(parsed.skillGroups[1].skills[0].name).toBe("C");
    });
});
