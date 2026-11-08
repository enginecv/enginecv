import { expect, test } from "@playwright/test";

test.describe("about page", () => {
    test("footer link opens the About page with its sections", async ({ page }) => {
        await page.goto("/");

        const link = page.locator('footer a[href="/about"]');
        await link.scrollIntoViewIfNeeded();
        await link.click();

        await expect(page).toHaveURL(/\/about$/);
        await expect(page.getByRole("heading", { level: 1, name: "About EngineCV" })).toBeVisible();
        for (const name of ["Who builds EngineCV", "Why it exists", "How your data is handled"]) {
            await expect(page.getByRole("heading", { level: 2, name })).toBeVisible();
        }
    });
});
