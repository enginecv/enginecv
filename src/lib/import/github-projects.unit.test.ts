import { describe, expect, it, vi } from "vitest";
import { createId } from "@/lib/id";
import { createEmptyResume } from "@/lib/schema";
import { createMockGithubFetch, makeRawRepo } from "./__fixtures__/mockGithubFetch";
import { createGithubProvider } from "./github";
import { appendGithubProjects, existingGithubRepoKeys, githubRepoKey, parseGithubRepoInput } from "./github-projects";
import { normalizedRepositorySchema, type NormalizedRepository } from "./provider";

function repo(name: string, overrides: Partial<NormalizedRepository> = {}): NormalizedRepository {
    return normalizedRepositorySchema.parse({
        name,
        description: `${name} description`,
        url: `https://github.com/octocat/${name}`,
        primaryLanguage: "TypeScript",
        createdAt: "2024-02-15T10:00:00Z",
        pushedAt: "2024-06-20T10:00:00Z",
        ...overrides,
    });
}

describe("parseGithubRepoInput", () => {
    it.each([
        ["octocat/hello-world", "octocat", "hello-world"],
        ["https://github.com/octocat/hello-world", "octocat", "hello-world"],
        ["github.com/octocat/hello-world/tree/main/src?x=1", "octocat", "hello-world"],
        ["https://www.github.com/octocat/hello-world.git", "octocat", "hello-world"],
        ["git@github.com:octocat/hello-world.git", "octocat", "hello-world"],
        ["  octocat/my.repo_name  ", "octocat", "my.repo_name"],
    ])("parses %s", (input, owner, name) => {
        expect(parseGithubRepoInput(input)).toEqual({ owner, repo: name });
    });

    it.each(["", "octocat", "https://github.com/octocat", "https://gitlab.com/a/b", "https://evilgithub.com/a/b", "a b/c", "-bad/repo", "octocat/.."])(
        "rejects %j",
        (input) => {
            expect(parseGithubRepoInput(input)).toBeNull();
        },
    );
});

describe("existing repo detection", () => {
    it("matches project URLs and attached repo links case-insensitively", () => {
        const projects = createEmptyResume().projects;
        projects.push(
            { ...repoProject("A"), url: "https://github.com/Octocat/Hello-World/", repos: [] },
            { ...repoProject("B"), url: "https://example.com", repos: [{ id: "r", url: "github.com/octocat/other.git", platform: "github", label: "" }] },
        );
        expect([...existingGithubRepoKeys(projects)].sort()).toEqual(["octocat/hello-world", "octocat/other"]);
        expect(githubRepoKey("https://example.com")).toBeNull();
    });
});

function repoProject(name: string) {
    return appendGithubProjects([], [repo(name)], { languages: new Map(), createId }).projects[0];
}

describe("appendGithubProjects", () => {
    it("appends new repositories after the existing projects and keeps those untouched", () => {
        const existing = [{ ...repoProject("kept"), description: "edited by hand" }];
        const result = appendGithubProjects(existing, [repo("kept"), repo("fresh", { stars: 12, topics: ["cli"] })], {
            languages: new Map([["fresh", { Rust: 300, Shell: 20 }]]),
            referenceDate: new Date("2026-10-25T00:00:00Z"),
            createId,
        });

        expect(result.added).toBe(1);
        expect(result.skipped).toBe(1);
        expect(result.projects[0]).toBe(existing[0]);
        expect(result.projects[1]).toMatchObject({
            name: "fresh",
            description: "fresh description",
            skills: ["Rust", "Shell"],
            keywords: ["cli"],
            highlights: ["★ 12 on GitHub"],
            start: "2024-02",
            end: "2024-06",
            url: "https://github.com/octocat/fresh",
            visibility: "public",
        });
        expect(result.projects[1].repos).toEqual([expect.objectContaining({ url: "https://github.com/octocat/fresh", platform: "github" })]);
    });

    it("gives every new project a unique id", () => {
        const { projects } = appendGithubProjects([], [repo("a"), repo("b")], { languages: new Map(), createId });
        expect(new Set(projects.flatMap((project) => [project.id, project.repos[0].id])).size).toBe(4);
    });
});

describe("fetchRepository", () => {
    it("normalizes one public repository", async () => {
        const mock = createMockGithubFetch([
            { match: /\/repos\/octocat\/hello-world$/, body: makeRawRepo({ name: "hello-world", html_url: "https://github.com/octocat/hello-world" }) },
        ]);
        const result = await createGithubProvider(mock.fetch).fetchRepository("octocat", "hello-world");
        expect(result).toMatchObject({ name: "hello-world", url: "https://github.com/octocat/hello-world" });
        expect(mock.calls()).toEqual(["https://api.github.com/repos/octocat/hello-world"]);
    });

    it("sends no credentials, token or cookie to GitHub", async () => {
        const fetchImpl = vi.fn(async () => new Response(JSON.stringify(makeRawRepo()), { status: 200 }));
        await createGithubProvider(fetchImpl as unknown as typeof fetch).fetchRepository("octocat", "repo");
        const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
        expect(init.credentials).toBeUndefined();
        expect(Object.keys(init.headers as Record<string, string>).map((key) => key.toLowerCase())).toEqual(["accept"]);
    });
});
