import profileFixture from "./profile.json";
import profileMinimalFixture from "./profile-minimal.json";

export interface RawGithubRepo {
    name: string;
    description: string | null;
    topics: string[];
    stargazers_count: number;
    language: string | null;
    fork: boolean;
    archived: boolean;
    created_at: string;
    pushed_at: string;
    html_url: string;
}

export interface RawGithubOrganization {
    login: string;
    name?: string | null;
    description?: string | null;
    html_url?: string | null;
    avatar_url?: string | null;
}

export function makeRawOrganization(overrides: Partial<RawGithubOrganization> = {}): RawGithubOrganization {
    return {
        login: "github",
        name: "GitHub",
        description: "Where the world builds software.",
        html_url: "https://github.com/github",
        avatar_url: "https://avatars.githubusercontent.com/u/9919?v=4",
        ...overrides,
    };
}

export function makeRawRepo(overrides: Partial<RawGithubRepo> = {}): RawGithubRepo {
    return {
        name: "repo",
        description: "A sample repository.",
        topics: ["sample"],
        stargazers_count: 0,
        language: "TypeScript",
        fork: false,
        archived: false,
        created_at: "2024-02-15T10:00:00Z",
        pushed_at: "2025-11-20T10:00:00Z",
        html_url: "https://github.com/octocat/repo",
        ...overrides,
    };
}

/** n distinct repos named repo-0..repo-(n-1), descending stars. */
export function makeRawRepoList(n: number, overrides: Partial<RawGithubRepo> = {}): RawGithubRepo[] {
    return Array.from({ length: n }, (_, i) =>
        makeRawRepo({
            name: `repo-${i}`,
            stargazers_count: Math.max(0, n - i),
            html_url: `https://github.com/octocat/repo-${i}`,
            ...overrides,
        }),
    );
}

export { profileFixture, profileMinimalFixture };

export interface MockRoute {
    /** Substring or regex matched against the request URL. */
    match: string | RegExp;
    status?: number;
    body?: unknown;
    headers?: Record<string, string>;
    /** Throw instead of responding (network failure). */
    reject?: boolean;
}

export interface MockGithubFetch {
    fetch: typeof fetch;
    calls: () => string[];
}

/**
 * Fetch-compatible mock. Routes are checked in order; first match wins.
 * Unmatched URLs get a 500 so tests fail loudly on unexpected requests.
 */
export function createMockGithubFetch(routes: MockRoute[]): MockGithubFetch {
    const calls: string[] = [];

    const mockFetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);

        for (const route of routes) {
            const matches =
                typeof route.match === "string" ? url.includes(route.match) : route.match.test(url);
            if (!matches) continue;

            if (route.reject) {
                throw new TypeError("Failed to fetch");
            }

            return new Response(JSON.stringify(route.body ?? {}), {
                status: route.status ?? 200,
                headers: { "content-type": "application/json", ...route.headers },
            });
        }

        return new Response("unexpected request", { status: 500 });
    }) as typeof fetch;

    return { fetch: mockFetch, calls: () => [...calls] };
}

/** Standard happy-path route set: profile + one repo page + organizations + languages. */
export function happyPathRoutes(repos: RawGithubRepo[] = makeRawRepoList(12)): MockRoute[] {
    return [
        { match: /\/users\/[^/]+\/repos/, body: repos },
        { match: /\/users\/[^/]+\/orgs/, body: [makeRawOrganization()] },
        { match: /\/users\/[^/]+$/, body: profileFixture },
        {
            match: /\/repos\/[^/]+\/[^/]+\/languages/,
            body: { TypeScript: 12000, CSS: 3000 },
        },
    ];
}
