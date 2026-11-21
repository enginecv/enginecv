import { describe, expect, it, vi } from "vitest";
import { createGithubProvider, RAW_MAX_REQUESTS } from "./github";

function fakeFetch(routes: Array<{ match: RegExp; status?: number; body?: unknown; text?: string; headers?: Record<string, string> }>) {
    const calls: string[] = [];
    const impl = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        const route = routes.find((candidate) => candidate.match.test(url));
        if (!route) return new Response("not found", { status: 404 });
        return new Response(route.text ?? JSON.stringify(route.body ?? {}), { status: route.status ?? 200, headers: route.headers });
    });
    return { fetch: impl as unknown as typeof fetch, calls };
}

describe("extra profile and repository fields", () => {
    it("keeps the public email, handle, member-since date, homepage, license and forks that GitHub already sends", async () => {
        const mock = fakeFetch([
            { match: /\/users\/octocat$/, body: { login: "octocat", name: "The Octocat", email: "octo@example.com", twitter_username: "octocat", created_at: "2011-01-25T18:44:36Z", public_repos: 8, followers: 12000, hireable: true } },
            { match: /\/users\/octocat\/repos/, body: [{ name: "site", html_url: "https://github.com/octocat/site", homepage: "octocat.dev/site", license: { spdx_id: "MIT" }, forks_count: 7, stargazers_count: 3 }, { name: "x", html_url: "https://github.com/octocat/x", license: { spdx_id: "NOASSERTION" }, homepage: "" }] },
        ]);
        const provider = createGithubProvider(mock.fetch);
        const profile = await provider.fetchProfile("octocat");
        expect(profile).toMatchObject({ email: "octo@example.com", twitter: "octocat", createdAt: "2011-01-25T18:44:36Z", publicRepos: 8, followers: 12000, hireable: true });
        const { repos } = await provider.fetchRepositories("octocat");
        expect(repos.find((repo) => repo.name === "site")).toMatchObject({ homepage: "https://octocat.dev/site", license: "MIT", forks: 7 });
        expect(repos.find((repo) => repo.name === "x")).toMatchObject({ license: "", homepage: "" });
    });
});

describe("README and dependency details (raw.githubusercontent.com, not the API)", () => {
    it("reads the profile README into a short summary without touching the API", async () => {
        const mock = fakeFetch([{ match: /raw\.githubusercontent\.com\/octocat\/octocat\/HEAD\/README\.md$/, text: "# Hi\n\nI build developer tools and write about compilers in my free time.\n" }]);
        const provider = createGithubProvider(mock.fetch);
        expect(await provider.fetchProfileReadme!("octocat")).toBe("I build developer tools and write about compilers in my free time.");
        expect(provider.requestCount()).toBe(0);
        expect(provider.rawRequestCount()).toBe(1);
    });

    it("returns nothing, never throws, when the README is missing or the network fails", async () => {
        const provider = createGithubProvider(fakeFetch([]).fetch);
        expect(await provider.fetchProfileReadme!("ghost")).toBe("");
        const failing = createGithubProvider((async () => { throw new TypeError("offline"); }) as unknown as typeof fetch);
        expect(await failing.fetchProfileReadme!("ghost")).toBe("");
        expect((await failing.fetchRepoDetails!("ghost", [{ name: "a", primaryLanguage: "Go" }])).size).toBe(0);
    });

    it("reads each picked repository's README and the dependency file that fits its language", async () => {
        const mock = fakeFetch([
            { match: /octocat\/web\/HEAD\/README\.md$/, text: "# web\n\nA small site for sharing recipes with friends and family around the world.\n" },
            { match: /octocat\/web\/HEAD\/package\.json$/, text: JSON.stringify({ dependencies: { react: "1", next: "1" } }) },
            { match: /octocat\/svc\/HEAD\/go\.mod$/, text: "module x\nrequire github.com/gin-gonic/gin v1.9.0\n" },
        ]);
        const provider = createGithubProvider(mock.fetch);
        const details = await provider.fetchRepoDetails!("octocat", [{ name: "web", primaryLanguage: "TypeScript" }, { name: "svc", primaryLanguage: "Go" }, { name: "empty", primaryLanguage: "Haskell" }]);
        expect(details.get("web")).toEqual({ summary: "A small site for sharing recipes with friends and family around the world.", stack: ["React", "Next.js"] });
        expect(details.get("svc")).toEqual({ summary: "", stack: ["Gin"] });
        expect(details.has("empty")).toBe(false);
        expect(provider.requestCount()).toBe(0);
        // Nothing but raw files was asked for, and only the fitting dependency file per repository.
        expect(mock.calls.every((url) => url.startsWith("https://raw.githubusercontent.com/octocat/"))).toBe(true);
        expect(mock.calls.some((url) => url.endsWith("/svc/HEAD/package.json"))).toBe(false);
    });

    it("skips a file that is too large and stops at the per-import ceiling", async () => {
        const big = fakeFetch([{ match: /README\.md$/, text: "x", headers: { "content-length": "999999" } }]);
        expect(await createGithubProvider(big.fetch).fetchProfileReadme!("a")).toBe("");
        const many = fakeFetch([]);
        const provider = createGithubProvider(many.fetch);
        const repos = Array.from({ length: 15 }, (_, index) => ({ name: `r${index}`, primaryLanguage: "TypeScript" }));
        for (let round = 0; round < 4; round += 1) await provider.fetchRepoDetails!("a", repos);
        expect(provider.rawRequestCount()).toBeLessThanOrEqual(RAW_MAX_REQUESTS);
    });
});

describe("contributions", () => {
    it("groups merged pull requests to other people's projects with one search request", async () => {
        const mock = fakeFetch([{ match: /\/search\/issues\?/, body: { items: [
            { repository_url: "https://api.github.com/repos/vercel/next.js", title: "Fix image loader" },
            { repository_url: "https://api.github.com/repos/vercel/next.js", title: "Docs" },
            { repository_url: "https://api.github.com/repos/a/b", title: "One" },
        ] } }]);
        const provider = createGithubProvider(mock.fetch);
        const contributions = await provider.fetchContributions!("octocat");
        expect(contributions.map((entry) => [entry.repo, entry.mergedPrs])).toEqual([["vercel/next.js", 2], ["a/b", 1]]);
        expect(provider.requestCount()).toBe(1);
        expect(decodeURIComponent(mock.calls[0])).toContain("author:octocat type:pr is:merged -user:octocat");
    });

    it("returns an empty list, never throws, when the search is refused", async () => {
        const provider = createGithubProvider(fakeFetch([{ match: /search/, status: 403, body: {}, headers: { "x-ratelimit-remaining": "0" } }]).fetch);
        expect(await provider.fetchContributions!("octocat")).toEqual([]);
    });
});
