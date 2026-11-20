import { canonicalizeGithubInput } from "./canonicalize";
import { groupContributions, manifestsFor, profileReadmeToSummary, readmeToSummary, stackFromManifest } from "./github-extras";
import {
    ImportError,
    normalizedOrganizationSchema,
    normalizedProfileSchema,
    normalizedRepositorySchema,
    profileSuggestionSchema,
    type ImportProvider,
    type Contribution,
    type LanguageBreakdown,
    type NormalizedOrganization,
    type NormalizedRepository,
    type ProfileSuggestion,
    type RepoDetails,
    type RepositoryFetchResult,
} from "./provider";

const API_BASE = "https://api.github.com";
const REQUEST_TIMEOUT_MS = 10_000;
const REPOS_PER_PAGE = 100;
const MAX_REPO_PAGES = 2;
const MAX_LANGUAGE_LOOKUPS = 10;
const LANGUAGE_CONCURRENCY = 4;
const SUGGESTIONS_PER_SEARCH = 5;

/** Hard ceiling: 1 profile + 2 repo pages + 1 org lookup + 10 language lookups + 1 contributions search. */
export const GITHUB_MAX_REQUESTS = 15;

const RAW_BASE = "https://raw.githubusercontent.com";
/** Files read from raw.githubusercontent.com (not the API, so not part of its rate limit) per import. */
export const RAW_MAX_REQUESTS = 80;
const RAW_MAX_BYTES = 300_000;
const RAW_CONCURRENCY = 4;
const MAX_DETAIL_REPOS = 15;

interface RawProfile {
    login?: string;
    name?: string | null;
    bio?: string | null;
    company?: string | null;
    blog?: string | null;
    location?: string | null;
    avatar_url?: string | null;
    html_url?: string | null;
    email?: string | null;
    twitter_username?: string | null;
    created_at?: string | null;
    public_repos?: number;
    followers?: number;
    hireable?: boolean | null;
}

interface RawRepo {
    name?: string;
    description?: string | null;
    topics?: string[] | null;
    stargazers_count?: number;
    language?: string | null;
    fork?: boolean;
    archived?: boolean;
    private?: boolean;
    created_at?: string | null;
    pushed_at?: string | null;
    html_url?: string | null;
    homepage?: string | null;
    license?: { spdx_id?: string | null } | null;
    forks_count?: number;
}

interface RawOrganization {
    login?: string;
    name?: string | null;
    description?: string | null;
    html_url?: string | null;
    avatar_url?: string | null;
}

interface RawUserSearchResult {
    items?: Array<{ login?: string; avatar_url?: string | null }>;
}

function normalizeWebsite(blog: string | null | undefined): string {
    const value = (blog ?? "").trim();
    if (!value) return "";
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function classifyResponse(response: Response): ImportError {
    if (response.status === 404) {
        return new ImportError("not-found");
    }

    const remaining = response.headers.get("x-ratelimit-remaining");
    const retryAfter = response.headers.get("retry-after");
    if ((response.status === 403 || response.status === 429) && (remaining === "0" || retryAfter)) {
        const reset = response.headers.get("x-ratelimit-reset");
        const resetAt = reset ? new Date(Number(reset) * 1000) : null;
        return new ImportError("rate-limited", resetAt);
    }

    return new ImportError("network");
}

export interface GithubProvider extends ImportProvider {
    /** Number of api.github.com requests issued by this provider instance. */
    requestCount(): number;
    /** Files read from raw.githubusercontent.com by this provider instance. */
    rawRequestCount(): number;
    /** One public repository by owner and name. Throws ImportError. */
    fetchRepository(owner: string, name: string): Promise<NormalizedRepository>;
}

export function createGithubProvider(fetchImpl: typeof fetch = fetch): GithubProvider {
    let requests = 0;
    let rawRequests = 0;

    async function request(path: string): Promise<Response> {
        if (requests >= GITHUB_MAX_REQUESTS) {
            throw new ImportError("network");
        }
        requests += 1;

        let response: Response;
        try {
            response = await fetchImpl(`${API_BASE}${path}`, {
                headers: { Accept: "application/vnd.github+json" },
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            });
        } catch {
            throw new ImportError("network");
        }

        if (!response.ok) {
            throw classifyResponse(response);
        }
        return response;
    }

    /** One file from a public repository, or null when it is missing, too large or cannot be read. Never throws. */
    async function rawFile(owner: string, repo: string, path: string): Promise<string | null> {
        if (rawRequests >= RAW_MAX_REQUESTS) return null;
        rawRequests += 1;
        try {
            const response = await fetchImpl(`${RAW_BASE}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/HEAD/${path}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
            if (!response.ok) return null;
            const size = Number(response.headers.get("content-length") ?? 0);
            if (size > RAW_MAX_BYTES) return null;
            const text = await response.text();
            return text.length > RAW_MAX_BYTES ? null : text;
        } catch {
            return null;
        }
    }

    function normalizeRepo(raw: RawRepo): NormalizedRepository {
        return normalizedRepositorySchema.parse({
            name: raw.name ?? "",
            description: raw.description ?? "",
            topics: raw.topics ?? [],
            stars: raw.stargazers_count ?? 0,
            primaryLanguage: raw.language ?? "",
            createdAt: raw.created_at ?? "",
            pushedAt: raw.pushed_at ?? "",
            isFork: raw.fork ?? false,
            isArchived: raw.archived ?? false,
            isPrivate: raw.private ?? false,
            url: raw.html_url ?? "",
            homepage: normalizeWebsite(raw.homepage),
            license: raw.license?.spdx_id && raw.license.spdx_id !== "NOASSERTION" ? raw.license.spdx_id : "",
            forks: raw.forks_count ?? 0,
        });
    }

    function normalizeOrganization(raw: RawOrganization): NormalizedOrganization {
        const login = raw.login ?? "";
        return normalizedOrganizationSchema.parse({
            login,
            name: raw.name ?? login,
            description: raw.description ?? "",
            url: raw.html_url ?? (login ? `https://github.com/${login}` : ""),
            avatarUrl: raw.avatar_url ?? "",
        });
    }

    return {
        name: "github",

        canonicalizeInput: canonicalizeGithubInput,

        requestCount: () => requests,

        rawRequestCount: () => rawRequests,

        async fetchProfile(username) {
            const response = await request(`/users/${encodeURIComponent(username)}`);
            const raw = (await response.json()) as RawProfile;

            return normalizedProfileSchema.parse({
                username: raw.login || username,
                displayName: raw.name ?? "",
                bio: raw.bio ?? "",
                location: raw.location ?? "",
                website: normalizeWebsite(raw.blog),
                company: raw.company ?? "",
                avatarUrl: raw.avatar_url ?? "",
                profileUrl: raw.html_url ?? `https://github.com/${username}`,
                email: raw.email ?? "",
                twitter: raw.twitter_username ?? "",
                createdAt: raw.created_at ?? "",
                publicRepos: raw.public_repos ?? 0,
                followers: raw.followers ?? 0,
                hireable: raw.hireable ?? false,
            });
        },

        async fetchRepositories(username): Promise<RepositoryFetchResult> {
            const repos: NormalizedRepository[] = [];
            let truncated = false;

            for (let page = 1; page <= MAX_REPO_PAGES; page += 1) {
                const response = await request(
                    `/users/${encodeURIComponent(username)}/repos?per_page=${REPOS_PER_PAGE}&sort=pushed&page=${page}`,
                );
                const rawRepos = (await response.json()) as RawRepo[];
                repos.push(...rawRepos.filter((raw) => raw.name).map(normalizeRepo));

                const hasNext = /rel="next"/.test(response.headers.get("link") ?? "");
                if (!hasNext) {
                    truncated = false;
                    break;
                }
                truncated = page === MAX_REPO_PAGES;
            }

            repos.sort((a, b) => {
                if (b.stars !== a.stars) return b.stars - a.stars;
                return b.pushedAt.localeCompare(a.pushedAt);
            });

            return { repos, truncated };
        },

        async fetchRepository(owner, name): Promise<NormalizedRepository> {
            const response = await request(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`);
            return normalizeRepo((await response.json()) as RawRepo);
        },

        async fetchOrganizations(username): Promise<NormalizedOrganization[]> {
            const response = await request(`/users/${encodeURIComponent(username)}/orgs?per_page=100`);
            const rawOrganizations = (await response.json()) as RawOrganization[];

            return rawOrganizations
                .filter((raw) => raw.login)
                .map(normalizeOrganization)
                .sort((a, b) => a.login.localeCompare(b.login));
        },

        async fetchLanguages(username, repoNames): Promise<LanguageBreakdown> {
            const names = repoNames.slice(0, MAX_LANGUAGE_LOOKUPS);
            const result: LanguageBreakdown = new Map();

            let cursor = 0;
            async function worker() {
                while (cursor < names.length) {
                    const name = names[cursor];
                    cursor += 1;
                    try {
                        const response = await request(
                            `/repos/${encodeURIComponent(username)}/${encodeURIComponent(name)}/languages`,
                        );
                        const breakdown = (await response.json()) as Record<string, number>;
                        result.set(name, breakdown);
                    } catch {
                        // Individual lookup failures degrade to the repo-level
                        // primary language; the import must not fail here.
                    }
                }
            }

            await Promise.all(
                Array.from({ length: Math.min(LANGUAGE_CONCURRENCY, names.length) }, worker),
            );

            return result;
        },

        async fetchProfileReadme(username): Promise<string> {
            const text = (await rawFile(username, username, "README.md")) ?? (await rawFile(username, username, "readme.md"));
            return text ? profileReadmeToSummary(text) : "";
        },

        async fetchRepoDetails(username, repos): Promise<Map<string, RepoDetails>> {
            const targets = repos.slice(0, MAX_DETAIL_REPOS);
            const result = new Map<string, RepoDetails>();
            let cursor = 0;
            async function worker() {
                while (cursor < targets.length) {
                    const target = targets[cursor];
                    cursor += 1;
                    const readme = (await rawFile(username, target.name, "README.md")) ?? (await rawFile(username, target.name, "readme.md"));
                    const stack: string[] = [];
                    for (const manifest of manifestsFor(target.primaryLanguage)) {
                        const text = await rawFile(username, target.name, manifest.file);
                        if (text) for (const tech of stackFromManifest(manifest.kind, text)) if (!stack.includes(tech)) stack.push(tech);
                    }
                    const summary = readme ? readmeToSummary(readme) : "";
                    if (summary || stack.length > 0) result.set(target.name, { summary, stack: stack.slice(0, 8) });
                }
            }
            await Promise.all(Array.from({ length: Math.min(RAW_CONCURRENCY, targets.length) }, worker));
            return result;
        },

        async fetchContributions(username): Promise<Contribution[]> {
            try {
                const query = encodeURIComponent(`author:${username} type:pr is:merged -user:${username}`);
                const response = await request(`/search/issues?q=${query}&per_page=100&sort=updated&order=desc`);
                const raw = (await response.json()) as { items?: Array<{ repository_url?: string; title?: string; html_url?: string }> };
                return groupContributions(raw.items ?? []);
            } catch {
                return [];
            }
        },

        async searchUsers(query): Promise<ProfileSuggestion[]> {
            const response = await request(
                `/search/users?q=${encodeURIComponent(query)}&per_page=${SUGGESTIONS_PER_SEARCH}`,
            );
            const raw = (await response.json()) as RawUserSearchResult;

            return (raw.items ?? [])
                .filter((item) => item.login)
                .slice(0, SUGGESTIONS_PER_SEARCH)
                .map((item) =>
                    profileSuggestionSchema.parse({
                        login: item.login,
                        avatarUrl: item.avatar_url ?? "",
                    }),
                );
        },
    };
}
