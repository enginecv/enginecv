import { expect, type Page } from "@playwright/test";

/**
 * The hero demo loads once it scrolls into view (below the hero copy on
 * phones), so scroll to it before waiting for the real showcase. The scroll
 * runs in one page call because the placeholder is replaced as it loads.
 */
export async function showLandingDemo(page: Page) {
    await page.evaluate(() => {
        document.querySelector('[data-testid="landing-demo-placeholder"]')
            ?.scrollIntoView({ block: "center" });
    });
    await expect(page.getByTestId("landing-template-showcase")).toBeVisible({ timeout: 30_000 });
}
