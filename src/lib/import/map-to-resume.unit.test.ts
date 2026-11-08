import { describe, expect, it } from "vitest";
import { resumeSchema, type Resume } from "@/lib/schema";
import { mapToResume } from "./map-to-resume";
import {
    type ImportProvider,
    type LanguageBreakdown,
    type NormalizedOrganization,
    type NormalizedProfile,
    type NormalizedRepository,
} from "./provider";

const referenceDate = new Date("2026-07-07T12:00:00Z");

const profile: NormalizedProfile = {
    username: "octocat",
    displayName: "The Octocat",
    bio: "Building open-source tools.",
    location: "San Francisco",
    website: "https://octocat.dev",
    company: "@github",
    avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
    profileUrl: "https://github.com/octocat",
};

const repos: NormalizedRepository[] = [
    {
        name: "engine-cv",
        description: "Local-first resume builder.",
        topics: ["resume", "typescript"],
        stars: 42,
        primaryLanguage: "TypeScript",
        createdAt: "2024-02-15T10:00:00Z",
        pushedAt: "2026-06-20T10:00:00Z",
        isFork: false,
        isArchived: false,
        isPrivate: false,
        url: "https://github.com/octocat/engine-cv",
    },
    {
        name: "cli-tools",
        description: "",
        topics: [],
        stars: 9,
        primaryLanguage: "Go",
        createdAt: "2021-07-01T10:00:00Z",
        pushedAt: "2025-01-12T10:00:00Z",
        isFork: false,
        isArchived: false,
        isPrivate: false,
        url: "https://github.com/octocat/cli-tools",
    },
];

const organizations: NormalizedOrganization[] = [
    {
        login: "github",
        name: "GitHub",
        description: "Open-source collaboration.",
        url: "https://github.com/github",
        avatarUrl: "",
    },
    {
        login: "openjs-foundation",
        name: "OpenJS Foundation",
        description: "",
        url: "https://github.com/openjs-foundation",
        avatarUrl: "",
    },
];

function expectValid(resume: Resume) {
    expect(() => resumeSchema.parse(resume)).not.toThrow();
}

function languageSkills(resume: { skillGroups: { name: string; skills: { id: string; name: string; level: string; icon: string; display: string }[] }[] }) {
    return resume.skillGroups.find((group) => group.name === "Programming Languages")?.skills ?? [];
}

describe("mapToResume", () => {
    it("maps profile basics, selected repositories, star highlights, dates, and skills", () => {
        const languages: LanguageBreakdown = new Map<string, Record<string, number>>([
            ["engine-cv", { TypeScript: 12000, CSS: 3000 }],
            ["cli-tools", { Go: 8000 }],
        ]);

        const resume = mapToResume(
            profile,
            repos,
            ["engine-cv", "cli-tools"],
            languages,
            "data:image/png;base64,avatar",
            { referenceDate },
        );

        expectValid(resume);
        expect(resume.id).toBeUndefined();
        expect(resume.createdAt).toBe(0);
        expect(resume.updatedAt).toBe(0);
        expect(resume.meta.title).toBe("octocat — GitHub import");
        expect(resume.basics).toMatchObject({
            name: "The Octocat",
            summary: "Building open-source tools.",
            location: "San Francisco",
            website: "https://octocat.dev",
            github: "https://github.com/octocat",
            photo: "data:image/png;base64,avatar",
        });
        expect(resume.projects).toHaveLength(2);
        expect(resume.projects[0]).toMatchObject({
            id: "github-project-engine-cv",
            name: "engine-cv",
            description: "Local-first resume builder.",
            keywords: ["resume", "typescript"],
            start: "2024-02",
            end: "",
            url: "https://github.com/octocat/engine-cv",
            repos: [{ url: "https://github.com/octocat/engine-cv", platform: "github" }],
        });
        expect(resume.projects[0].highlights).toEqual(["★ 42 on GitHub"]);
        expect(resume.projects[1]).toMatchObject({
            name: "cli-tools",
            description: "",
            start: "2021-07",
            end: "2025-01",
        });
        expect(resume.projects[1].highlights).toEqual([]);
        expect(languageSkills(resume).map((skill) => [skill.name, skill.level, skill.icon, skill.display])).toEqual([
            ["TypeScript", "competent", "auto", "both"],
            ["Go", "competent", "auto", "both"],
            ["CSS", "competent", "auto", "both"],
        ]);
        expect(resume.settings.contentSections).toEqual(["projects", "skills"]);
    });

    it("fills each project's skills-used tags from that repo's languages", () => {
        const languages: LanguageBreakdown = new Map([
            ["engine-cv", { TypeScript: 12000, CSS: 3000 }],
        ]);

        const resume = mapToResume(
            profile,
            repos,
            ["engine-cv", "cli-tools"],
            languages,
            "",
            { referenceDate },
        );

        expectValid(resume);
        // detailed breakdown → byte-ordered languages
        expect(resume.projects[0].skills).toEqual(["TypeScript", "CSS"]);
        // no breakdown fetched → repo-level primary language fallback
        expect(resume.projects[1].skills).toEqual(["Go"]);
        // Skills section covers the union of per-project skills
        const sectionNames = languageSkills(resume).map((skill) => skill.name);
        for (const name of [...resume.projects[0].skills, ...resume.projects[1].skills]) {
            expect(sectionNames).toContain(name);
        }
    });

    it("maps selected organizations into Organisation entries", () => {
        const resume = mapToResume(profile, repos, [], new Map(), "", {
            referenceDate,
            organizations,
            selectedOrganizationLogins: ["github"],
        });

        expectValid(resume);
        expect(resume.organisations).toEqual([
            {
                id: "github-organisation-github",
                hidden: false,
                name: "GitHub",
                role: "Member",
                start: "",
                end: "",
                location: "",
                description: "Open-source collaboration.",
                skills: [],
                url: "https://github.com/github",
                urlIcon: "auto",
            },
        ]);
        expect(resume.settings.contentSections).toEqual(["organisations"]);
    });

    it("keeps generated skill ids unique when language slugs collide", () => {
        const collisionRepo: NormalizedRepository = {
            ...repos[0],
            name: "systems-lab",
            primaryLanguage: "C",
            url: "https://github.com/octocat/systems-lab",
        };
        const languages: LanguageBreakdown = new Map([
            ["systems-lab", { C: 400, "C++": 300, "C#": 200, "C Plus Plus": 100 }],
        ]);

        const resume = mapToResume(profile, [collisionRepo], ["systems-lab"], languages, "", {
            referenceDate,
        });

        expectValid(resume);
        expect(languageSkills(resume).map((skill) => skill.name)).toEqual(["C", "C++", "C#", "C Plus Plus"]);
        expect(languageSkills(resume).map((skill) => skill.id)).toEqual([
            "github-skill-c",
            "github-skill-c-plus-plus",
            "github-skill-c-sharp",
            "github-skill-c-plus-plus-2",
        ]);
        expect(new Set(languageSkills(resume).map((skill) => skill.id)).size).toBe(languageSkills(resume).length);
    });

    it("skips missing profile fields without placeholders", () => {
        const resume = mapToResume(
            {
                ...profile,
                displayName: "",
                bio: "",
                location: "",
                website: "",
                avatarUrl: "",
            },
            [],
            [],
            new Map(),
            "",
            { referenceDate },
        );

        expectValid(resume);
        expect(resume.basics.name).toBe("");
        expect(resume.basics.summary).toBe("");
        expect(resume.basics.location).toBe("");
        expect(resume.basics.website).toBe("");
        expect(resume.basics.photo).toBe("");
        expect(resume.projects).toEqual([]);
        expect(resume.skillGroups).toHaveLength(1);
        expect(resume.skillGroups[0].skills).toEqual([]);
    });

    it("imports basics only when nothing is selected", () => {
        const resume = mapToResume(profile, repos, [], new Map(), "", { referenceDate });

        expectValid(resume);
        expect(resume.basics.name).toBe("The Octocat");
        expect(resume.projects).toEqual([]);
        expect(resume.skillGroups).toHaveLength(1);
        expect(resume.skillGroups[0].skills).toEqual([]);
    });

    it("preserves selected repository order from the fetched picker list", () => {
        const resume = mapToResume(profile, repos, ["cli-tools", "engine-cv"], new Map(), "", {
            referenceDate,
        });

        expect(resume.projects.map((project) => project.name)).toEqual(["engine-cv", "cli-tools"]);
    });

    it("falls back to primary language when detailed language data is missing", () => {
        const resume = mapToResume(profile, repos, ["engine-cv", "cli-tools"], new Map(), "", {
            referenceDate,
        });

        expect(languageSkills(resume).map((skill) => skill.name)).toEqual(["Go", "TypeScript"]);
    });

    it("is deterministic for identical inputs", () => {
        const languages: LanguageBreakdown = new Map([["engine-cv", { TypeScript: 100 }]]);

        const first = mapToResume(profile, repos, ["engine-cv"], languages, "", { referenceDate });
        const second = mapToResume(profile, repos, ["engine-cv"], languages, "", { referenceDate });

        expect(first).toEqual(second);
    });

    it("keeps the mapper provider-independent", async () => {
        const dummy: ImportProvider = {
            name: "dummy",
            canonicalizeInput: (raw) => raw.trim() || null,
            fetchProfile: async () => profile,
            fetchRepositories: async () => ({ repos, truncated: false }),
            fetchOrganizations: async () => organizations,
            fetchLanguages: async () => new Map([["engine-cv", { Ada: 1000 }]]),
        };

        const fetchedProfile = await dummy.fetchProfile("octocat");
        const fetchedRepos = await dummy.fetchRepositories("octocat");
        const languages = await dummy.fetchLanguages("octocat", ["engine-cv"]);
        const resume = mapToResume(
            fetchedProfile,
            fetchedRepos.repos,
            ["engine-cv"],
            languages,
            "",
            { referenceDate },
        );

        expectValid(resume);
        expect(resume.projects[0].name).toBe("engine-cv");
        expect(languageSkills(resume)[0].name).toBe("Ada");
    });
});
