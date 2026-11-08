import { expect, test, type Page } from "@playwright/test";
import { bs } from "../src/lib/i18n/bs";
import { de } from "../src/lib/i18n/de";

async function startInGerman(page: Page) {
    await page.goto("/de");
    await expect.poll(() => page.evaluate(() => document.cookie)).toContain("enginecv-locale=de");
}

test("contact and support UI follow language changes at 360px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await startInGerman(page);
    await page.goto("/contact");
    await expect(page.getByRole("heading", { name: de["contact.title"] })).toBeVisible();
    await page.getByRole("button", { name: de["language.change"] }).first().click();
    await page.getByRole("button", { name: "Bosanski", exact: true }).click();
    await expect(page.getByRole("heading", { name: bs["contact.title"] })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await page.screenshot({ path: "test-results/gui-contact-bs.png", fullPage: true });

    await page.goto("/supporters");
    await expect(page.getByRole("heading", { name: bs["supporters.thanks"] })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test("template editor controls follow app language on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await startInGerman(page);
    await page.goto("/templates/enginecv-modern");
    await expect(page.getByText(de["templateEditor.readOnly"], { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder(de["templateEditor.description"])).toBeVisible();
    await page.getByRole("button", { name: de["editor.preview"], exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await expect(page.getByText("Built-in template (read-only)", { exact: true })).toHaveCount(0);
});
