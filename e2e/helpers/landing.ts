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

/**
 * Sections fade in when they scroll into view, so a scan taken before that
 * finishes sees half-transparent text and reports false contrast failures.
 * Scrolls the whole page once, then lets every transition end.
 */
export async function revealLandingSections(page: Page) {
    await page.evaluate(async () => {
        const step = Math.max(400, Math.floor(window.innerHeight / 2));
        for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise((resolve) => setTimeout(resolve, 120));
        }
        window.scrollTo(0, 0);
        await new Promise((resolve) => setTimeout(resolve, 900));
        await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
    });
}
