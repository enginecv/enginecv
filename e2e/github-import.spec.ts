import { expect, test, type Page, type Route } from "@playwright/test";
import { corsHeaders, mockGithubHappyPath } from "./helpers/github-mocks";

async function openGithubImport(page: Page) {
    // The nav button is gone; the create menu and start links still open the import.
    await page.goto("/dashboard?start=github");
    await expect(page.getByTestId("github-import-dialog")).toBeVisible();
}

test("imports a GitHub profile into a new resume and opens the editor", async ({ page }) => {
    await mockGithubHappyPath(page);
    await openGithubImport(page);

    await page.getByTestId("github-import-input").fill("octocat");
    await page.getByTestId("github-import-submit").click();
    await expect(page.getByText("engine-cv")).toBeVisible();
    await expect(page.getByText("framework-fork")).toBeVisible();
    await expect(page.getByText("GitHub", { exact: true })).toBeVisible();
    await expect(page.getByText("Fork", { exact: true })).toBeVisible();
    await page.getByTestId("github-import-confirm").click();

    await expect(page).toHaveURL(/\/editor\/[^/]+$/, { timeout: 15_000 });
    await expect(page.getByText("The Octocat").first()).toBeVisible();
    await expect(page.locator(".resume-page").first().getByText("engine-cv", { exact: true })).toBeVisible();

    // The Content panel must list the imported sections as editable cards.
    await expect(page.getByTestId("section-card-projects")).toBeVisible();
    await expect(page.getByTestId("section-card-skills")).toBeVisible();
    await expect(page.getByTestId("section-card-organisations")).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-resume-card").filter({ hasText: "octocat" })).toBeVisible();
});

test("shows a specific not-found error and lets the user correct the input", async ({ page }) => {
    await page.route("https://api.github.com/**", async (route: Route) => {
        await route.fulfill({ status: 404, headers: corsHeaders, json: {} });
    });

    await openGithubImport(page);
    await page.getByTestId("github-import-input").fill("missing-user");
    await page.getByTestId("github-import-submit").click();

    await expect(page.getByText(/No GitHub profile found for "missing-user"/)).toBeVisible();
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByTestId("github-import-input")).toBeVisible();
});

test("shows rate-limit guidance without retrying automatically", async ({ page }) => {
    let calls = 0;
    await page.route("https://api.github.com/**", async (route: Route) => {
        calls += 1;
        await route.fulfill({
            status: 403,
            headers: {
                ...corsHeaders,
                "content-type": "application/json",
                "x-ratelimit-remaining": "0",
                "x-ratelimit-reset": "1780000000",
            },
            body: JSON.stringify({ message: "rate limited" }),
        });
    });

    await openGithubImport(page);
    await page.getByTestId("github-import-input").fill("octocat");
    await page.getByTestId("github-import-submit").click();

    await expect(page.getByText("GitHub's hourly request limit for your network is used up.")).toBeVisible();
    expect(calls).toBe(1);
});
