import type { Page } from "@playwright/test";

// GitHub API responses shared by the dashboard import and the tool page specs.

const profile = {
    login: "octocat",
    name: "The Octocat",
    bio: "Open-source builder.",
    company: "@github",
    blog: "octocat.dev",
    location: "San Francisco",
    avatar_url: "",
    html_url: "https://github.com/octocat",
};

const repos = [
    {
        name: "engine-cv",
        description: "Local-first resume builder.",
        topics: ["resume", "typescript"],
        stargazers_count: 42,
        language: "TypeScript",
        fork: false,
        archived: false,
        created_at: "2024-02-15T10:00:00Z",
        pushed_at: "2026-06-20T10:00:00Z",
        html_url: "https://github.com/octocat/engine-cv",
    },
    {
        name: "framework-fork",
        description: "Forked framework notes.",
        topics: ["framework"],
        stargazers_count: 2,
        language: "JavaScript",
        fork: true,
        archived: false,
        created_at: "2020-01-01T10:00:00Z",
        pushed_at: "2020-02-01T10:00:00Z",
        html_url: "https://github.com/octocat/framework-fork",
    },
];

const organizations = [
    {
        login: "github",
        name: "GitHub",
        description: "Where the world builds software.",
        html_url: "https://github.com/github",
        avatar_url: "",
    },
];

export const corsHeaders = {
    "access-control-allow-origin": "*",
    "access-control-expose-headers": "x-ratelimit-remaining,x-ratelimit-reset,retry-after,link",
};

export async function mockGithubHappyPath(page: Page) {
    await page.route("https://api.github.com/**", async (route) => {
        const url = new URL(route.request().url());

        if (url.pathname === "/users/octocat") {
            await route.fulfill({ status: 200, headers: corsHeaders, json: profile });
            return;
        }

        if (url.pathname === "/users/octocat/repos") {
            await route.fulfill({ status: 200, headers: corsHeaders, json: repos });
            return;
        }

        if (url.pathname === "/users/octocat/orgs") {
            await route.fulfill({ status: 200, headers: corsHeaders, json: organizations });
            return;
        }

        if (url.pathname === "/repos/octocat/engine-cv/languages") {
            await route.fulfill({
                status: 200,
                headers: corsHeaders,
                json: { TypeScript: 12000, CSS: 3000 },
            });
            return;
        }

        await route.fulfill({ status: 404, headers: corsHeaders, json: {} });
    });
}
