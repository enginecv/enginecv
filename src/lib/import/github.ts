import { canonicalizeGithubInput } from "./canonicalize";
import {
    ImportError,
    normalizedOrganizationSchema,
    normalizedProfileSchema,
    normalizedRepositorySchema,
    profileSuggestionSchema,
    type ImportProvider,
    type LanguageBreakdown,
    type NormalizedOrganization,
    type NormalizedRepository,
    type ProfileSuggestion,
    type RepositoryFetchResult,
} from "./provider";

const API_BASE = "https://api.github.com";
const REQUEST_TIMEOUT_MS = 10_000;
const REPOS_PER_PAGE = 100;
const MAX_REPO_PAGES = 2;
const MAX_LANGUAGE_LOOKUPS = 10;
const LANGUAGE_CONCURRENCY = 4;
const SUGGESTIONS_PER_SEARCH = 5;

/** Hard ceiling: 1 profile + 2 repo pages + 1 org lookup + 10 language lookups. */
export const GITHUB_MAX_REQUESTS = 14;

interface RawProfile {
    login?: string;
    name?: string | null;
    bio?: string | null;
    company?: string | null;
    blog?: string | null;
    location?: string | null;
    avatar_url?: string | null;
    html_url?: string | null;
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
    /** One public repository by owner and name. Throws ImportError. */
    fetchRepository(owner: string, name: string): Promise<NormalizedRepository>;
}

export function createGithubProvider(fetchImpl: typeof fetch = fetch): GithubProvider {
    let requests = 0;

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
