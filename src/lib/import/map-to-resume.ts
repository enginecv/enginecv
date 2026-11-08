import { createEmptyResume, createUngroupedSkillGroup, resumeSchema, type Resume } from "@/lib/schema";
import { repoToProject } from "./github-projects";
import { uniqueImportId } from "./ids";
import {
    type LanguageBreakdown,
    type NormalizedOrganization,
    type NormalizedProfile,
    type NormalizedRepository,
} from "./provider";

interface MapToResumeOptions {
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
    const base = createEmptyResume();
    const projectIds = new Set<string>();
    const repoIds = new Set<string>();

    const projects = selectedRepos.map((repo) =>
        repoToProject(repo, {
            languages,
            referenceDate,
            projectId: uniqueImportId("github-project", repo.name, projectIds),
            repoLinkId: uniqueImportId("github-repo", repo.name, repoIds),
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
    const skillGroups = [
        createUngroupedSkillGroup(),
        ...(languageSkills.length > 0
            ? [{ id: uniqueImportId("github-skill-group", "programming-languages", skillIds), name: "Programming Languages", hidden: false, skills: languageSkills }]
            : []),
    ];

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
        ...(projects.length > 0 ? ["projects"] : []),
        ...(languageSkills.length > 0 ? ["skills"] : []),
        ...(organisations.length > 0 ? ["organisations"] : []),
    ];

    return resumeSchema.parse({
        ...base,
        id: undefined,
        createdAt: 0,
        updatedAt: 0,
        basics: {
            ...base.basics,
            name: profile.displayName,
            photo: avatarDataUrl,
            location: profile.location,
            website: profile.website,
            github: profile.profileUrl,
            summary: profile.bio,
        },
        meta: {
            ...base.meta,
            title: `${profile.username} — GitHub import`,
        },
        projects,
        skillGroups,
        organisations,
        settings: {
            ...base.settings,
            contentSections,
        },
    });
}
