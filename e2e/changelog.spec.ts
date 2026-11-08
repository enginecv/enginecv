import { expect, test } from "@playwright/test";

test.describe("changelog page", () => {
    test("renders the changelog with newest section first", async ({ page }) => {
        await page.goto("/changelog");

        await expect(page.getByRole("heading", { level: 1, name: "Changelog" })).toBeVisible();

        const sections = page.locator("section[id]");
        await expect(sections.first()).toBeVisible();

        const sectionIds = await sections.evaluateAll((els) =>
            els
                .map((el) => el.getAttribute("id") ?? "")
                .filter((id) => /^\d{4}-\d{2}-\d{2}/.test(id)),
        );
        expect(sectionIds.length).toBeGreaterThan(0);
        const normalized = sectionIds.map((id) => id.slice(0, 10));
        const sorted = [...normalized].sort((a, b) => b.localeCompare(a));
        expect(normalized).toEqual(sorted);

        await expect(page.locator("section[id] li").first()).toBeVisible();
    });

    test("footer link navigates from the landing page to the changelog", async ({ page }) => {
        await page.goto("/");

        const footerLink = page.locator('footer a[href="/changelog"]');
        await footerLink.scrollIntoViewIfNeeded();
        await footerLink.click();

        await expect(page).toHaveURL(/\/changelog$/);
        await expect(page.getByRole("heading", { level: 1, name: "Changelog" })).toBeVisible();
    });

    test("date heading anchors update the URL hash", async ({ page }) => {
        await page.goto("/changelog");

        const firstDatedSection = page.locator("section[id]").last();
        const slug = await firstDatedSection.getAttribute("id");
        await firstDatedSection.locator("h2 a").click();

        await expect(page).toHaveURL(new RegExp(`#${slug}$`));
    });

    test("has no horizontal scroll at 360px width", async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 740 });
        await page.goto("/changelog");

        await expect(page.getByRole("heading", { level: 1, name: "Changelog" })).toBeVisible();

        const scrollWidth = await page.evaluate(
            () => document.documentElement.scrollWidth,
        );
        expect(scrollWidth).toBeLessThanOrEqual(360);
    });

    test("makes no network requests for changelog content after load", async ({ page }) => {
        await page.goto("/changelog");
        await expect(page.getByRole("heading", { level: 1, name: "Changelog" })).toBeVisible();
        // "load", not "networkidle": third-party requests (e.g. ads) can keep the
        // network busy indefinitely. Requests are only recorded from here on.
        await page.waitForLoadState("load");

        const postLoadRequests: string[] = [];
        page.on("request", (request) => {
            if (request.resourceType() === "fetch" || request.resourceType() === "xhr") {
                postLoadRequests.push(request.url());
            }
        });

        await page.locator("section[id]").last().scrollIntoViewIfNeeded();
        await page.waitForTimeout(1_000);

        // Production builds prefetch routes linked on the page (`?_rsc=`). That is
        // navigation prefetching, not the page fetching its own content, which is
        // what this test guards.
        const changelogRequests = postLoadRequests.filter(
            (url) => url.toLowerCase().includes("changelog") && !url.includes("_rsc="),
        );
        expect(changelogRequests).toEqual([]);
    });
});
