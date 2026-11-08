import { projectSchema, type Project, type Resume } from "@/lib/schema";
import { slugId } from "./ids";
import type { LanguageBreakdown, NormalizedRepository } from "./provider";

const STAR_HIGHLIGHT_THRESHOLD = 10;
const RECENT_PUSH_MONTHS = 3;
// GitHub repository names: letters, digits, '.', '-', '_'; at most 100 characters.
const REPO_NAME_PATTERN = /^[\w.-]{1,100}$/;
const OWNER_PATTERN = /^[a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d])){0,38}$/;

export interface GithubRepoRef {
    owner: string;
    repo: string;
}

/**
 * Accepts "owner/repo", a github.com repository URL (any trailing path,
 * query or ".git"), or an SSH clone address. Returns null for anything that
 * does not name a single repository, including bare usernames.
 */
export function parseGithubRepoInput(raw: string): GithubRepoRef | null {
    let value = raw.trim();
    if (!value) return null;

    const ssh = /^git@github\.com:(.+)$/i.exec(value);
    if (ssh) {
        value = ssh[1];
    } else if (/github\.com/i.test(value)) {
        const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
        let url: URL;
        try {
            url = new URL(withScheme);
        } catch {
            return null;
        }
        if (!/(^|\.)github\.com$/i.test(url.hostname)) return null;
        value = url.pathname;
    } else if (value.includes(":") || value.includes(" ")) {
        return null;
    }

    const [owner, rawRepo] = value.split("/").filter(Boolean);
    const repo = rawRepo?.replace(/\.git$/i, "");
    if (!owner || !repo || !OWNER_PATTERN.test(owner) || !REPO_NAME_PATTERN.test(repo)) return null;
    if (repo === "." || repo === "..") return null;
    return { owner, repo };
}

export function toYearMonth(value: string): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}

function isWithinRecentPushWindow(value: string, referenceDate: Date): boolean {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;

    const cutoff = new Date(referenceDate);
    cutoff.setUTCMonth(cutoff.getUTCMonth() - RECENT_PUSH_MONTHS);
    return date >= cutoff;
}

/**
 * Languages used by one repository, ordered by byte count when the detailed
 * breakdown was fetched, falling back to the repo-level primary language.
 */
export function repoSkillNames(repo: NormalizedRepository, languages: LanguageBreakdown): string[] {
    const breakdown = languages.get(repo.name);
    const usable = breakdown
        ? Object.entries(breakdown).filter(([, bytes]) => Number.isFinite(bytes) && bytes > 0)
        : [];

    if (usable.length > 0) {
        return usable.sort((a, b) => b[1] - a[1]).map(([language]) => language);
    }

    return repo.primaryLanguage ? [repo.primaryLanguage] : [];
}

interface RepoToProjectOptions {
    languages: LanguageBreakdown;
    referenceDate: Date;
    projectId: string;
    repoLinkId: string;
}

/** One repository as a resume project; shared by new-CV import and add-to-existing-CV. */
export function repoToProject(repo: NormalizedRepository, options: RepoToProjectOptions): Project {
    return projectSchema.parse({
        id: options.projectId,
        name: repo.name,
        subtitle: "",
        description: repo.description,
        highlights: repo.stars >= STAR_HIGHLIGHT_THRESHOLD ? [`★ ${repo.stars} on GitHub`] : [],
        keywords: repo.topics,
        skills: repoSkillNames(repo, options.languages),
        start: toYearMonth(repo.createdAt),
        end: isWithinRecentPushWindow(repo.pushedAt, options.referenceDate) ? "" : toYearMonth(repo.pushedAt),
        url: repo.url,
        urlIcon: "auto",
        repos: repo.url ? [{ id: options.repoLinkId, url: repo.url, platform: "github", label: "" }] : [],
        visibility: repo.isPrivate ? "private" : "public",
    });
}

/** Lowercased github.com "owner/repo" for a URL, or null when it is not a GitHub repository. */
export function githubRepoKey(url: string | undefined): string | null {
    if (!url) return null;
    const ref = parseGithubRepoInput(url);
    return ref ? `${ref.owner}/${ref.repo}`.toLowerCase() : null;
}

/** A project links a GitHub repository, as its URL or as an attached repo link. */
export function isGithubProject(project: Pick<Project, "url"> & { repos?: Project["repos"] }): boolean {
    return [project.url, ...(project.repos ?? []).map((link) => link.url)].some((url) => githubRepoKey(url) !== null);
}

/** Repositories a resume already lists, by project URL or attached repo link. */
export function existingGithubRepoKeys(projects: Resume["projects"]): Set<string> {
    const keys = new Set<string>();
    for (const project of projects) {
        for (const url of [project.url, ...(project.repos ?? []).map((link) => link.url)]) {
            const key = githubRepoKey(url);
            if (key) keys.add(key);
        }
    }
    return keys;
}

interface AppendOptions {
    languages: LanguageBreakdown;
    referenceDate?: Date;
    createId: () => string;
}

/** Appends the repositories that are not on the resume yet; existing projects are never touched. */
export function appendGithubProjects(
    existing: Resume["projects"],
    repos: NormalizedRepository[],
    { languages, referenceDate = new Date(), createId }: AppendOptions,
): { projects: Resume["projects"]; added: number; skipped: number } {
    const seen = existingGithubRepoKeys(existing);
    const added: Project[] = [];
    let skipped = 0;

    for (const repo of repos) {
        const key = githubRepoKey(repo.url) ?? `name:${slugId(repo.name)}`;
        if (seen.has(key)) {
            skipped += 1;
            continue;
        }
        seen.add(key);
        added.push(repoToProject(repo, { languages, referenceDate, projectId: createId(), repoLinkId: createId() }));
    }

    return { projects: [...existing, ...added], added: added.length, skipped };
}
