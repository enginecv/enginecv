import { createUngroupedSkillGroup, projectSchema, resumeSchema, type Resume } from "@/lib/schema";
import { createNewResume } from "@/lib/templates/default-design";
import { repoToProject } from "./github-projects";
import { uniqueImportId } from "./ids";
import {
    type Contribution,
    type LanguageBreakdown,
    type NormalizedOrganization,
    type NormalizedProfile,
    type NormalizedRepository,
    type RepoDetails,
} from "./provider";
import { createId } from "@/lib/id";

/** Extra things read on request; each is applied only when it is present. */
export interface GithubExtras {
    /** Plain text from the profile README, used as the summary instead of the bio. */
    profileReadme?: string;
    /** README summaries and stacks by repository name. */
    repoDetails?: Map<string, RepoDetails>;
    /** Merged pull requests to other projects. */
    contributions?: Contribution[];
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TWITTER = /^[A-Za-z0-9_]{1,15}$/;

/** The person's own details a GitHub profile gives, as the import writes them. "" where GitHub has nothing usable. */
export function githubPersonalDetails(profile: NormalizedProfile) {
    return {
        name: profile.displayName,
        // Only an email the person made public on GitHub.
        email: profile.email && EMAIL.test(profile.email) ? profile.email : "",
        location: profile.location,
        website: profile.website,
        github: profile.profileUrl,
        summary: profile.bio,
        x: profile.twitter && TWITTER.test(profile.twitter) ? profile.twitter : "",
    };
}

interface MapToResumeOptions {
    extras?: GithubExtras;
    referenceDate?: Date;
    organizations?: NormalizedOrganization[];
    selectedOrganizationLogins?: Iterable<string>;
}

function aggregateLanguages(
    selectedRepos: NormalizedRepository[],
    languages: LanguageBreakdown,
): Array<{ name: string; weight: number }> {
    const totals = new Map<string, number>();

    for (const repo of selectedRepos) {
        const breakdown = languages.get(repo.name);
        const usableBreakdown = breakdown
            ? Object.entries(breakdown).filter(([, bytes]) => Number.isFinite(bytes) && bytes > 0)
            : [];

        if (usableBreakdown.length > 0) {
            for (const [language, bytes] of usableBreakdown) {
                totals.set(language, (totals.get(language) ?? 0) + bytes);
            }
            continue;
        }

        if (repo.primaryLanguage) {
            totals.set(repo.primaryLanguage, (totals.get(repo.primaryLanguage) ?? 0) + 1);
        }
    }

    return Array.from(totals, ([name, weight]) => ({ name, weight })).sort((a, b) => {
        if (b.weight !== a.weight) return b.weight - a.weight;
        return a.name.localeCompare(b.name);
    });
}

export function mapToResume(
    profile: NormalizedProfile,
    repos: NormalizedRepository[],
    selectedNames: Iterable<string>,
    languages: LanguageBreakdown,
    avatarDataUrl: string,
    options: MapToResumeOptions = {},
): Resume {
    const selected = new Set(selectedNames);
    const selectedRepos = repos.filter((repo) => selected.has(repo.name));
    const selectedOrganizationLogins = new Set(options.selectedOrganizationLogins ?? []);
    const selectedOrganizations = (options.organizations ?? []).filter((organization) =>
        selectedOrganizationLogins.has(organization.login),
    );
    const referenceDate = options.referenceDate ?? new Date();
    const base = createNewResume();
    const projectIds = new Set<string>();
    const repoIds = new Set<string>();

    const projects = selectedRepos.map((repo) =>
        repoToProject(repo, {
            languages,
            referenceDate,
            projectId: uniqueImportId("github-project", repo.name, projectIds),
            repoLinkId: uniqueImportId("github-repo", repo.name, repoIds),
            details: options.extras?.repoDetails?.get(repo.name),
        }),
    );

    const skillIds = new Set<string>();
    const languageSkills = aggregateLanguages(selectedRepos, languages).map(({ name }) => ({
        id: uniqueImportId("github-skill", name, skillIds),
        name,
        description: "",
        level: "competent",
        icon: "auto",
        display: "both" as const,
        keywords: [],
    }));
    // Frameworks and tools named by the picked repositories' dependency files, most used first.
    const toolCounts = new Map<string, number>();
    for (const repo of selectedRepos) for (const tech of options.extras?.repoDetails?.get(repo.name)?.stack ?? []) toolCounts.set(tech, (toolCounts.get(tech) ?? 0) + 1);
    const toolSkills = [...toolCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => ({
        id: uniqueImportId("github-skill", name, skillIds),
        name,
        description: "",
        level: "competent",
        icon: "auto",
        display: "both" as const,
        keywords: [],
    }));
    const skillGroups = [
        createUngroupedSkillGroup(),
        ...(languageSkills.length > 0
            ? [{ id: uniqueImportId("github-skill-group", "programming-languages", skillIds), name: "Programming Languages", hidden: false, skills: languageSkills }]
            : []),
        ...(toolSkills.length > 0
            ? [{ id: uniqueImportId("github-skill-group", "frameworks-and-tools", skillIds), name: "Frameworks and Tools", hidden: false, skills: toolSkills }]
            : []),
    ];

    // Contributions to other people's projects are listed as projects (the review step has no custom sections),
    // after the person's own, each marked as a contribution.
    const contributionProjects = (options.extras?.contributions ?? []).map((contribution) =>
        projectSchema.parse({
            id: uniqueImportId("github-contribution", contribution.repo, projectIds),
            name: contribution.repo,
            subtitle: `Open-source contribution · ${contribution.mergedPrs} merged pull request${contribution.mergedPrs === 1 ? "" : "s"}`,
            description: contribution.titles.map((title) => `- ${title}`).join("\n"),
            keywords: ["open source"],
            url: contribution.url,
            repos: [{ id: uniqueImportId("github-repo", contribution.repo, repoIds), url: contribution.url, platform: "github", label: "" }],
            visibility: "public",
        }),
    );

    const organisationIds = new Set<string>();
    const organisations = selectedOrganizations.map((organization) => ({
        id: uniqueImportId("github-organisation", organization.login, organisationIds),
        name: organization.name || organization.login,
        role: "Member",
        start: "",
        end: "",
        location: "",
        description: organization.description,
        url: organization.url,
        urlIcon: "auto",
    }));
    const contentSections = [
        ...(projects.length + contributionProjects.length > 0 ? ["projects"] : []),
        ...(languageSkills.length > 0 || toolSkills.length > 0 ? ["skills"] : []),
        ...(organisations.length > 0 ? ["organisations"] : []),
    ];
    const details = githubPersonalDetails(profile);
    const customLinks = details.x
        ? [{ id: createId(), name: "X", url: `https://x.com/${details.x}`, label: `@${details.x}`, icon: "auto" }]
        : [];

    return resumeSchema.parse({
        ...base,
        id: undefined,
        createdAt: 0,
        updatedAt: 0,
        basics: {
            ...base.basics,
            name: details.name,
            photo: avatarDataUrl,
            email: details.email,
            location: details.location,
            website: details.website,
            github: details.github,
            summary: options.extras?.profileReadme || details.summary,
            customLinks,
        },
        meta: {
            ...base.meta,
            title: `${profile.username} — GitHub import`,
        },
        projects: [...projects, ...contributionProjects],
        skillGroups,
        organisations,
        settings: {
            ...base.settings,
            contentSections,
        },
    });
}
