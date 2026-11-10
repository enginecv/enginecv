import { expect, test } from "@playwright/test";

test.describe("section guides", () => {
    test("Get Tips opens the matching guide in a new tab and leaves the editor untouched", async ({ page }) => {
        await page.goto("/dashboard");
        await page.getByTestId("dashboard-new-resume").click();
        await page.getByTestId("create-resume-from-scratch").click();
        await expect(page).toHaveURL(/\/editor\/[^/]+$/);

        await page.getByTestId("add-content-experience").click();
        await page.getByTestId("entry-input-position").fill("Senior Engineer");
        await page.getByTestId("entry-input-company").fill("Acme Systems");

        const editorUrl = page.url();
        const link = page.getByTestId("get-tips-link").first();
        await expect(link).toBeVisible();

        const [guide] = await Promise.all([page.context().waitForEvent("page"), link.click()]);
        await guide.waitForLoadState("domcontentloaded");

        await expect(guide).toHaveURL(/\/guides\/work-experience-section$/);
        await expect(guide.getByRole("heading", { level: 1, name: /work experience/i })).toBeVisible();

        // The editor tab was not navigated and kept what was typed.
        expect(page.url()).toBe(editorUrl);
        await expect(page.getByTestId("entry-input-position")).toHaveValue("Senior Engineer");
        await expect(page.getByTestId("entry-input-company")).toHaveValue("Acme Systems");
    });

    test("the guides hub lists the published guide and the footer links to it", async ({ page }) => {
        await page.goto("/");
        const link = page.locator('footer a[href="/guides"]');
        await link.scrollIntoViewIfNeeded();
        await link.click();

        await expect(page).toHaveURL(/\/guides$/);
        await expect(page.getByRole("link", { name: /work experience section/i })).toBeVisible();
    });
});
