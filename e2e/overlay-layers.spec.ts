import { expect, test, type Page } from "@playwright/test";
import { openJsonFixture } from "./helpers/json-editor";

// Overlay layers and free placement (feature 087).

async function openOverlays(page: Page) {
    await page.getByTestId("sidebar-tab-customize").click();
    const row = page.getByTestId("customize-row-designOverlays");
    if (await row.isVisible().catch(() => false)) await row.click();
    await expect(page.getByRole("button", { name: "Shape", exact: true })).toBeVisible();
}

const element = (page: Page) => page.locator('.resume-page [data-design-element]').first();

async function topmostIsElement(page: Page) {
    return element(page).evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return hit?.closest("[data-design-element]") === node;
    });
}

test.describe("overlay layers", () => {
    test("an element can go behind the text and back, and keeps working with the layer buttons", async ({ page }) => {
        await openJsonFixture(page, false);
        await openOverlays(page);
        await page.getByRole("button", { name: "Shape", exact: true }).click();
        await expect(element(page)).toBeVisible();

        // In front by default, as before.
        await expect(page.locator('.resume-page [data-design-layer="front"] [data-design-element]')).toHaveCount(1);
        await expect(page.getByTestId("design-layer-front")).toHaveAttribute("aria-pressed", "true");

        await page.getByTestId("design-layer-behind").click();
        await expect(page.locator('.resume-page [data-design-layer="behind"] [data-design-element]')).toHaveCount(1);
        await expect(page.locator('.resume-page [data-design-layer="front"] [data-design-element]')).toHaveCount(0);
        await expect(page.getByTestId("design-layer-behind")).toHaveAttribute("aria-pressed", "true");

        // The CV's content is above it: the page content, not the shape, is under the pointer.
        await expect.poll(() => topmostIsElement(page)).toBe(false);

        // The layers list says which layer it is in, and it can come back to the front.
        await expect(page.getByText(/Behind text · z\d/)).toBeVisible();
        await page.getByTestId("design-layer-front").click();
        await expect.poll(() => topmostIsElement(page)).toBe(true);
    });

    test("an element can be nudged with the arrow keys and moved past the page edge, but not lost", async ({ page }) => {
        await openJsonFixture(page, false);
        await openOverlays(page);
        await page.getByRole("button", { name: "Shape", exact: true }).click();
        const pageBox = async () => (await page.locator(".resume-page").first().boundingBox())!;
        const box = async () => (await element(page).boundingBox())!;

        const start = await box();
        await page.keyboard.press("ArrowRight");
        await expect.poll(async () => Math.round((await box()).x - start.x)).toBeGreaterThan(0);

        // Far past the left edge: part of it bleeds off the paper but part stays reachable.
        for (let i = 0; i < 40; i += 1) await page.keyboard.press("Shift+ArrowLeft");
        await expect.poll(async () => (await box()).x).toBeLessThan((await pageBox()).x);
        const bled = await box();
        const paper = await pageBox();
        expect(bled.x + bled.width).toBeGreaterThan(paper.x + 8);
    });
});

test.describe("overlay layers in exports", () => {
    test("a behind-text element is still behind the text in the saved HTML file", async ({ page, browser }) => {
        const fs = await import("node:fs");
        const os = await import("node:os");
        const path = await import("node:path");

        await openJsonFixture(page, false);
        await openOverlays(page);
        await page.getByRole("button", { name: "Shape", exact: true }).click();
        await page.getByTestId("design-layer-behind").click();
        await expect(page.locator('.resume-page [data-design-layer="behind"] [data-design-element]')).toHaveCount(1);

        await page.getByTestId("export-menu-button").first().click();
        await page.getByTestId("export-format-html").click();
        const download = page.waitForEvent("download");
        await page.getByTestId("export-confirm-button").click();
        const target = path.join(os.tmpdir(), `enginecv-overlay-layer-${Date.now()}.html`);
        await (await download).saveAs(target);
        expect(fs.statSync(target).size).toBeGreaterThan(1000);

        const context = await browser.newContext({ offline: true, viewport: { width: 1280, height: 900 } });
        const view = await context.newPage();
        await view.goto(`file:///${target.replace(/\\/g, "/")}`);
        const layer = view.locator('[data-design-layer="behind"]');
        await expect(layer).toHaveCount(1);
        // Beneath the content (negative stacking inside the document) and the shape is not what a click on the text hits.
        const result = await view.evaluate(() => {
            const behind = document.querySelector<HTMLElement>('[data-design-layer="behind"]')!;
            const shape = behind.querySelector<HTMLElement>("[data-design-element]")!;
            const rect = shape.getBoundingClientRect();
            const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
            return { zIndex: getComputedStyle(behind).zIndex, shapeOnTop: hit?.closest("[data-design-element]") === shape };
        });
        expect(result.zIndex).toBe("-1");
        expect(result.shapeOnTop).toBe(false);
        await context.close();
        fs.rmSync(target, { force: true });
    });
});
