import { describe, expect, it } from "vitest";
import {
    createMockGithubFetch,
    makeRawOrganization,
    makeRawRepoList,
    profileFixture,
    profileMinimalFixture,
} from "./__fixtures__/mockGithubFetch";
import { createGithubProvider, GITHUB_MAX_REQUESTS } from "./github";
import { ImportError } from "./provider";

async function expectImportError(promise: Promise<unknown>): Promise<ImportError> {
    try {
        await promise;
    } catch (error) {
        expect(error).toBeInstanceOf(ImportError);
        return error as ImportError;
    }
    throw new Error("expected promise to reject with ImportError");
}

describe("createGithubProvider", () => {
    describe("fetchProfile", () => {
        it("normalizes a full profile", async () => {
            const mock = createMockGithubFetch([{ match: /\/users\/octocat$/, body: profileFixture }]);
            const provider = createGithubProvider(mock.fetch);

            const profile = await provider.fetchProfile("octocat");

            expect(profile).toMatchObject({
                username: "octocat",
                displayName: "The Octocat",
                bio: "Building things with tentacles. Open source enthusiast.",
                location: "San Francisco",
                website: "https://octocat.dev",
                company: "@github",
                profileUrl: "https://github.com/octocat",
            });
            expect(profile.avatarUrl).toContain("avatars.githubusercontent.com");
        });

        it("maps null fields to empty strings without placeholders", async () => {
            const mock = createMockGithubFetch([
                { match: /\/users\/ghost-user$/, body: profileMinimalFixture },
            ]);
            const provider = createGithubProvider(mock.fetch);

            const profile = await provider.fetchProfile("ghost-user");

            expect(profile.displayName).toBe("");
            expect(profile.bio).toBe("");
            expect(profile.location).toBe("");
            expect(profile.website).toBe("");
            expect(profile.avatarUrl).toBe("");
        });

        it("classifies 404 as not-found", async () => {
            const mock = createMockGithubFetch([{ match: /\/users\//, status: 404, body: {} }]);
            const provider = createGithubProvider(mock.fetch);

            const error = await expectImportError(provider.fetchProfile("nobody"));
            expect(error.kind).toBe("not-found");
        });

        it("classifies 403 with exhausted rate limit as rate-limited with resetAt", async () => {
            const resetEpoch = 1_780_000_000;
            const mock = createMockGithubFetch([
                {
                    match: /\/users\//,
                    status: 403,
                    body: {},
                    headers: {
                        "x-ratelimit-remaining": "0",
                        "x-ratelimit-reset": String(resetEpoch),
                    },
                },
            ]);
            const provider = createGithubProvider(mock.fetch);

            const error = await expectImportError(provider.fetchProfile("octocat"));
            expect(error.kind).toBe("rate-limited");
            expect(error.resetAt).toEqual(new Date(resetEpoch * 1000));
        });

        it("classifies fetch TypeError as network", async () => {
            const mock = createMockGithubFetch([{ match: /\/users\//, reject: true }]);
            const provider = createGithubProvider(mock.fetch);

            const error = await expectImportError(provider.fetchProfile("octocat"));
            expect(error.kind).toBe("network");
        });

        it("classifies 5xx as network", async () => {
            const mock = createMockGithubFetch([{ match: /\/users\//, status: 502, body: {} }]);
            const provider = createGithubProvider(mock.fetch);

            const error = await expectImportError(provider.fetchProfile("octocat"));
            expect(error.kind).toBe("network");
        });
    });

    describe("fetchRepositories", () => {
        it("fetches a single page when there is no next link", async () => {
            const mock = createMockGithubFetch([
                { match: /\/users\/octocat\/repos/, body: makeRawRepoList(30) },
            ]);
            const provider = createGithubProvider(mock.fetch);

            const result = await provider.fetchRepositories("octocat");

            expect(result.repos).toHaveLength(30);
            expect(result.truncated).toBe(false);
            expect(mock.calls().filter((u) => u.includes("/repos"))).toHaveLength(1);
        });

        it("follows exactly one next page and flags truncation beyond it", async () => {
            const linkNext = '<https://api.github.com/user/1/repos?page=2>; rel="next"';
            const mock = createMockGithubFetch([
                {
                    match: /repos\?per_page=100&sort=pushed&page=1/,
                    body: makeRawRepoList(100),
                    headers: { link: linkNext },
                },
                {
                    match: /repos\?per_page=100&sort=pushed&page=2/,
                    body: makeRawRepoList(100),
                    headers: { link: '<https://api.github.com/user/1/repos?page=3>; rel="next"' },
                },
            ]);
            const provider = createGithubProvider(mock.fetch);

            const result = await provider.fetchRepositories("octocat");

            expect(result.repos).toHaveLength(200);
            expect(result.truncated).toBe(true);
            expect(mock.calls().filter((u) => u.includes("/repos?"))).toHaveLength(2);
        });

        it("orders repos by stars descending then most recently pushed", async () => {
            const mock = createMockGithubFetch([
                {
                    match: /\/users\/octocat\/repos/,
                    body: [
                        ...makeRawRepoList(1).map((r) => ({
                            ...r,
                            name: "old-popular",
                            stargazers_count: 50,
                            pushed_at: "2024-01-01T00:00:00Z",
                        })),
                        ...makeRawRepoList(1).map((r) => ({
                            ...r,
                            name: "fresh-popular",
                            stargazers_count: 50,
                            pushed_at: "2026-01-01T00:00:00Z",
                        })),
                        ...makeRawRepoList(1).map((r) => ({
                            ...r,
                            name: "quiet",
                            stargazers_count: 2,
                        })),
                    ],
                },
            ]);
            const provider = createGithubProvider(mock.fetch);

            const result = await provider.fetchRepositories("octocat");

            expect(result.repos.map((r) => r.name)).toEqual([
                "fresh-popular",
                "old-popular",
                "quiet",
            ]);
        });

        it("normalizes null description and language to empty strings", async () => {
            const mock = createMockGithubFetch([
                {
                    match: /\/users\/octocat\/repos/,
                    body: makeRawRepoList(1, { description: null, language: null }),
                },
            ]);
            const provider = createGithubProvider(mock.fetch);

            const result = await provider.fetchRepositories("octocat");

            expect(result.repos[0].description).toBe("");
            expect(result.repos[0].primaryLanguage).toBe("");
        });
    });

    describe("fetchOrganizations", () => {
        it("normalizes public organization memberships", async () => {
            const mock = createMockGithubFetch([
                {
                    match: /\/users\/octocat\/orgs/,
                    body: [
                        makeRawOrganization({
                            login: "github",
                            name: null,
                            description: "Open source collaboration.",
                            html_url: null,
                        }),
                        makeRawOrganization({
                            login: "enginecv",
                            name: "EngineCV",
                            description: null,
                            html_url: "https://github.com/enginecv",
                        }),
                    ],
                },
            ]);
            const provider = createGithubProvider(mock.fetch);

            const organizations = await provider.fetchOrganizations("octocat");

            expect(organizations).toEqual([
                {
                    login: "enginecv",
                    name: "EngineCV",
                    description: "",
                    url: "https://github.com/enginecv",
                    avatarUrl: "https://avatars.githubusercontent.com/u/9919?v=4",
                },
                {
                    login: "github",
                    name: "github",
                    description: "Open source collaboration.",
                    url: "https://github.com/github",
                    avatarUrl: "https://avatars.githubusercontent.com/u/9919?v=4",
                },
            ]);
        });
    });

    describe("fetchLanguages", () => {
        it("caps lookups at 10 names even when given more", async () => {
            const mock = createMockGithubFetch([
                { match: /\/languages$/, body: { TypeScript: 1000 } },
            ]);
            const provider = createGithubProvider(mock.fetch);

            const names = Array.from({ length: 50 }, (_, i) => `repo-${i}`);
            const result = await provider.fetchLanguages("octocat", names);

            expect(result.size).toBe(10);
            expect(mock.calls().filter((u) => u.endsWith("/languages"))).toHaveLength(10);
        });

        it("degrades individual lookup failures silently", async () => {
            const mock = createMockGithubFetch([
                { match: /\/repos\/octocat\/bad\/languages$/, status: 500, body: {} },
                { match: /\/languages$/, body: { Go: 500 } },
            ]);
            const provider = createGithubProvider(mock.fetch);

            const result = await provider.fetchLanguages("octocat", ["good", "bad"]);

            expect(result.get("good")).toEqual({ Go: 500 });
            expect(result.has("bad")).toBe(false);
        });
    });

    describe("searchUsers", () => {
        it("maps search hits to login + avatar suggestions, capped at five", async () => {
            const items = Array.from({ length: 8 }, (_, i) => ({
                login: `user-${i}`,
                avatar_url: `https://avatars.githubusercontent.com/u/${i}?v=4`,
            }));
            const mock = createMockGithubFetch([{ match: /\/search\/users\?/, body: { items } }]);
            const provider = createGithubProvider(mock.fetch);

            const suggestions = await provider.searchUsers!("user");

            expect(suggestions).toHaveLength(5);
            expect(suggestions[0]).toEqual({
                login: "user-0",
                avatarUrl: "https://avatars.githubusercontent.com/u/0?v=4",
            });
            expect(mock.calls()[0]).toContain("/search/users?q=user&per_page=5");
        });

        it("url-encodes the query and tolerates missing fields", async () => {
            const mock = createMockGithubFetch([
                {
                    match: /\/search\/users\?/,
                    body: { items: [{ login: "octo" }, { avatar_url: "x" }, {}] },
                },
            ]);
            const provider = createGithubProvider(mock.fetch);

            const suggestions = await provider.searchUsers!("weird name");

            expect(mock.calls()[0]).toContain("q=weird%20name");
            expect(suggestions).toEqual([{ login: "octo", avatarUrl: "" }]);
        });

        it("classifies a search rate limit as rate-limited", async () => {
            const mock = createMockGithubFetch([
                {
                    match: /\/search\/users\?/,
                    status: 403,
                    headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1800000000" },
                    body: {},
                },
            ]);
            const provider = createGithubProvider(mock.fetch);

            const error = await expectImportError(provider.searchUsers!("octocat"));
            expect(error.kind).toBe("rate-limited");
        });

        it("counts against the provider's request budget", async () => {
            const mock = createMockGithubFetch([{ match: /\/search\/users\?/, body: { items: [] } }]);
            const provider = createGithubProvider(mock.fetch);

            await provider.searchUsers!("octocat");
            expect(provider.requestCount()).toBe(1);
        });
    });

    describe("request budget", () => {
        it("never exceeds the 13-request ceiling on a worst-case import", async () => {
            const linkNext = '<https://api.github.com/user/1/repos?page=2>; rel="next"';
            const mock = createMockGithubFetch([
                {
                    match: /repos\?per_page=100&sort=pushed&page=1/,
                    body: makeRawRepoList(100),
                    headers: { link: linkNext },
                },
                { match: /repos\?per_page=100&sort=pushed&page=2/, body: makeRawRepoList(100) },
                { match: /\/users\/octocat\/orgs/, body: [makeRawOrganization()] },
                { match: /\/users\/octocat$/, body: profileFixture },
                { match: /\/languages$/, body: { TypeScript: 1000 } },
            ]);
            const provider = createGithubProvider(mock.fetch);

            await provider.fetchProfile("octocat");
            const { repos } = await provider.fetchRepositories("octocat");
            await provider.fetchOrganizations("octocat");
            await provider.fetchLanguages(
                "octocat",
                repos.slice(0, 50).map((r) => r.name),
            );

            expect(mock.calls().length).toBeLessThanOrEqual(GITHUB_MAX_REQUESTS);
            expect(provider.requestCount()).toBe(mock.calls().length);
        });
    });
});
