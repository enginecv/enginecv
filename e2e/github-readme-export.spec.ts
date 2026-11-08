import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

async function createResume(page: Page) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-scratch").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);

    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-name-input").fill("Readme Person");
    await page.getByTestId("basics-form-back").click();

    await page.getByTestId("add-content-experience").click();
    await page.getByTestId("entry-input-position").fill("Export Role");
    await page.getByTestId("entry-input-company").fill("Acme Systems");
    await page.getByTestId("section-form-back").click();
    await expect(page.locator(".resume-page").first().getByText("Export Role")).toBeVisible();
}

async function openReadmeDialog(page: Page) {
    await page.getByTestId("export-menu-button").first().click();
    await page.getByTestId("export-github-readme").click();
    await expect(page.getByTestId("github-readme-dialog")).toBeVisible();
}

test("copies the GitHub profile README", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Clipboard permissions are Chromium-only in Playwright");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await createResume(page);
    await openReadmeDialog(page);

    await page.getByTestId("github-readme-copy").click();
    await expect(page.getByTestId("github-readme-dialog")).toContainText("Copied");
    // The OS clipboard may hand back CRLF line endings (Windows).
    const markdown = (await page.evaluate(() => navigator.clipboard.readText())).split(String.fromCharCode(13)).join("");
    expect(markdown).toContain("# Readme Person");
    expect(markdown).toContain("**Export Role** · Acme Systems");
    expect(markdown).toBe(await page.getByTestId("github-readme-preview").inputValue());
});

test("downloads the README package with both cards", async ({ page }) => {
    await createResume(page);
    await openReadmeDialog(page);
    await page.getByTestId("github-readme-credit").click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("github-readme-package").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^github-readme-.*\.zip$/);

    const zip = await JSZip.loadAsync(await readFile(await download.path()));
    expect(Object.keys(zip.files).sort()).toEqual(["README.md", "enginecv-card-dark.svg", "enginecv-card-light.svg"]);
    const readme = await zip.file("README.md")!.async("string");
    expect(readme).toContain('srcset="./enginecv-card-dark.svg"');
    expect(readme).toContain("https://enginecv.app/r/github-readme");
    expect(await zip.file("enginecv-card-light.svg")!.async("string")).toContain("Readme Person");
});

test("README dialog fits a phone screen", async ({ page }) => {
    await createResume(page);
    await page.setViewportSize({ width: 360, height: 760 });
    await page.getByRole("button", { name: "Open actions menu" }).click();
    await page.getByTestId("export-menu-button").filter({ visible: true }).click();
    await page.getByTestId("export-github-readme").click();
    const dialog = page.getByTestId("github-readme-dialog");
    await expect(dialog).toBeVisible();
    const overflow = await dialog.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});
