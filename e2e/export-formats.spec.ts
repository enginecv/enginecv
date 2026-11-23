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

test("exports a LaTeX source file with the CV's content", async ({ page }) => {
    await createResume(page);
    const { name, bytes } = await exportAs(page, "tex");
    expect(name).toMatch(/^resume-.*\.tex$/);
    const text = bytes.toString("utf8");
    expect(text).toContain("\\documentclass");
    expect(text).toContain("\\begin{document}");
    expect(text).toContain("Export Role");
    expect(text).toContain("Acme Systems");
    expect(text.trimEnd().endsWith("\\end{document}")).toBe(true);
});

test("shows eight formats as two full rows of four, and the LaTeX note", async ({ page }) => {
    await createResume(page);
    await page.getByTestId("export-menu-button").first().click();
    const cards = page.locator('[data-testid^="export-format-"]').filter({ hasNot: page.locator("[data-never]") });
    const ids = ["json", "jsonresume", "pdf", "docx", "md", "txt", "tex", "html"];
    const boxes = [];
    for (const id of ids) boxes.push((await page.getByTestId(`export-format-${id}`).boundingBox())!);
    expect(await cards.count()).toBeGreaterThanOrEqual(8);
    const rows = new Set(boxes.map((box) => Math.round(box.y)));
    expect(rows.size).toBe(2);
    for (const row of rows) expect(boxes.filter((box) => Math.round(box.y) === row)).toHaveLength(4);
    // Same width everywhere: no card spans, and none is left short.
    const widths = new Set(boxes.map((box) => Math.round(box.width)));
    expect(widths.size).toBe(1);

    await page.getByTestId("export-format-tex").click();
    await expect(page.getByTestId("export-latex-note")).toContainText("standard CV layout");
    await expect(page.getByTestId("export-copy-clipboard")).toContainText("LaTeX");
});

for (const locale of ["bs", "de", "fr", "es"]) {
    test(`LaTeX card and note fit the dialog in ${locale}`, async ({ page }) => {
        await page.addInitScript((stored: string) => {
            window.localStorage.setItem("enginecv-locale", stored);
            document.cookie = `enginecv-locale=${stored}; path=/`;
        }, locale);
        await createResume(page);
        await page.getByTestId("export-menu-button").first().click();
        const card = page.getByTestId("export-format-tex");
        await expect(card).toBeVisible();
        await card.click();
        const note = page.getByTestId("export-latex-note");
        await expect(note).toContainText("XeLaTeX");
        const clipped = await page.getByRole("dialog").evaluate((dialog) => {
            const cards = Array.from(dialog.querySelectorAll<HTMLElement>('[data-testid^="export-format-"]'));
            return {
                cards: cards.filter((el) => el.scrollWidth > el.clientWidth + 1).length,
                dialog: dialog.scrollWidth - dialog.clientWidth,
            };
        });
        expect(clipped.cards).toBe(0);
        expect(clipped.dialog).toBeLessThanOrEqual(0);
    });
}

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

test("asks for an optional thumbs rating and comment on the second export", async ({ page }) => {
    const events: Record<string, unknown>[] = [];
    await page.route("**/api/e", async (route) => {
        events.push(JSON.parse(route.request().postData() ?? "{}"));
        await route.fulfill({ status: 204 });
    });
    await createResume(page);

    await exportAs(page, "docx");
    await expect(page.getByTestId("export-rating-card")).toBeHidden();
    await page.getByTestId("export-support-close").click();

    await exportAs(page, "docx");
    const card = page.getByTestId("export-rating-card");
    await expect(card).toBeVisible();
    await card.getByTestId("export-rating-down").click();
    await card.getByTestId("export-rating-comment").fill("fonts looked off, mail me a@b.co");
    await card.getByTestId("export-rating-comment-send").click();
    await expect(card).toBeHidden();

    expect(events.find((event) => event.event === "export_rating")).toMatchObject({ rating: "down", format: "docx" });
    expect(events.find((event) => event.event === "export_comment")).toMatchObject({ rating: "down", format: "docx" });

    // Answered once: it does not come back on the next milestone.
    await expect.poll(() => page.evaluate(() => localStorage.getItem("enginecv-preferences") ?? "")).toContain('"exportRatingDone":true');
});
