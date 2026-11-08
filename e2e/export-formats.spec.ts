import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y";

async function createResume(page: Page) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-scratch").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);

    await page.getByTestId("add-content-experience").click();
    await page.getByTestId("entry-input-position").fill("Export Role");
    await page.getByTestId("entry-input-company").fill("Acme Systems");
    await page.getByTestId("section-form-back").click();
    await expect(page.locator(".resume-page").first().getByText("Export Role")).toBeVisible();
}

async function exportAs(page: Page, format: string) {
    await page.getByTestId("export-menu-button").first().click();
    await page.getByTestId(`export-format-${format}`).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-confirm-button").click();
    const download = await downloadPromise;
    const path = await download.path();
    return { name: download.suggestedFilename(), bytes: await readFile(path) };
}

test("exports Markdown", async ({ page }) => {
    await createResume(page);
    const { name, bytes } = await exportAs(page, "md");
    expect(name).toMatch(/^resume-.*\.md$/);
    const text = bytes.toString("utf8");
    expect(text).toContain("## ");
    expect(text).toContain("Export Role");
});

test("exports plain text without markup", async ({ page }) => {
    await createResume(page);
    const { name, bytes } = await exportAs(page, "txt");
    expect(name).toMatch(/^resume-.*\.txt$/);
    const text = bytes.toString("utf8");
    expect(text).toContain("Export Role");
    expect(text).not.toContain("**");
});

test("exports an editable DOCX", async ({ page }) => {
    await createResume(page);
    const { name, bytes } = await exportAs(page, "docx");
    expect(name).toMatch(/^resume-.*\.docx$/);
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("Export Role");
    expect(xml).toContain("Acme Systems");
});

test("copies Text, Markdown and HTML from their tabs", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Clipboard permissions are Chromium-only in Playwright");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await createResume(page);

    await page.getByTestId("export-menu-button").first().click();
    await expect(page.getByTestId("export-copy-clipboard")).toHaveCount(0);

    await page.getByTestId("export-format-txt").click();
    await page.getByTestId("export-copy-clipboard").click();
    await expect(page.getByTestId("export-copy-clipboard")).toHaveText(/copied/i);
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain("Export Role");
    expect(text).not.toContain("## ");

    await page.getByTestId("export-format-md").click();
    await page.getByTestId("export-copy-clipboard").click();
    await expect(page.getByTestId("export-copy-clipboard")).toHaveText(/copied/i);
    const markdown = await page.evaluate(() => navigator.clipboard.readText());
    expect(markdown).toContain("## ");
    expect(markdown).toContain("Export Role");

    await page.getByTestId("export-format-html").click();
    await page.getByTestId("export-copy-clipboard").click();
    await expect(page.getByTestId("export-copy-clipboard")).toHaveText(/copied/i);
    const html = await page.evaluate(() => navigator.clipboard.readText());
    expect(html).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain("Export Role");
});

test("export dialog fits a phone screen", async ({ page }) => {
    await createResume(page);
    // Use the real phone path. Opening the dialog at desktop width and then
    // shrinking raced the switch to the mobile header, which unmounts the desktop
    // export button together with its dialog.
    await page.setViewportSize({ width: 400, height: 800 });
    await page.getByRole("button", { name: "Open actions menu" }).click();
    await page.getByTestId("export-menu-button").filter({ visible: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByTestId("export-format-docx")).toBeVisible();
    const overflow = await dialog.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
});

test("copies and downloads HTML on a phone while the content pane is showing", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "Clipboard permissions are Chromium-only in Playwright");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await createResume(page);
    await page.setViewportSize({ width: 400, height: 800 });
    // The phone layout mounts the preview pages only in the preview pane.
    await expect(page.locator(".resume-page")).toHaveCount(0);

    await page.getByRole("button", { name: "Open actions menu" }).click();
    await page.getByTestId("export-menu-button").filter({ visible: true }).click();
    await page.getByTestId("export-format-html").click();
    await page.getByTestId("export-copy-clipboard").click();
    await expect(page.getByTestId("export-copy-clipboard")).toHaveText(/copied/i);
    const html = await page.evaluate(() => navigator.clipboard.readText());
    expect(html).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain("Export Role");

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-confirm-button").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.html$/);
    expect(await readFile(await download.path(), "utf8")).toContain("Export Role");
});

test("asks for Ko-fi support after the first export without stealing focus", async ({ page }) => {
    await createResume(page);
    await exportAs(page, "docx");

    const card = page.getByTestId("export-support-card");
    await expect(card).toBeVisible();
    await expect(card.getByRole("link", { name: /Ko-fi/ })).toHaveAttribute("href", "/go/kofi/export");
    expect(await card.evaluate((node) => node.contains(document.activeElement))).toBe(false);
    await expectNoA11yViolations(page, { include: ["[data-testid=export-support-card]"], label: "export-support-card" });

    await card.getByTestId("export-support-dismiss").click();
    await expect(card).toBeHidden();

    await page.reload();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("enginecv-preferences") ?? "")).toContain(
        '"exportPromptDismissed":true',
    );
});
