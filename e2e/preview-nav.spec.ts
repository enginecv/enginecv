import { expect, test, type Page } from "@playwright/test";

// Live preview pointer behaviour in the editor (feature 083): a plain click on
// a link opens the Go to / Customize menu, Ctrl/Cmd+click follows the link, and
// double-clicking a section heading jumps to that section.
//
// The example CV only carries mailto: and tel: links. Opening an http link in a
// new tab (window.open with noopener) is covered by the ResumePreview
// integration tests.

async function openExampleInEditor(page: Page) {
    await page.goto("/cv-examples/software-developer");
    const button = page.getByTestId("edit-example");
    await expect(button).toBeVisible();
    await button.click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/, { timeout: 20_000 });
    await expect(page.locator(".resume-page").first()).toBeVisible({ timeout: 20_000 });
}

function emailLink(page: Page) {
    return page.locator('.resume-page a[href^="mailto:"]').first();
}

function menuButton(page: Page, name: string) {
    return page.getByRole("button", { name, exact: true });
}

test.describe("editor preview links", () => {
    test("a plain click opens the menu with Open link instead of following the link", async ({ page }) => {
        await openExampleInEditor(page);
        const editorUrl = page.url();
        const link = emailLink(page);
        await expect(link).toBeVisible();

        let popups = 0;
        page.context().on("page", () => { popups += 1; });
        await link.click();

        await expect(menuButton(page, "Open link")).toBeVisible();
        await expect(menuButton(page, "Customize section")).toBeVisible();
        expect(popups).toBe(0);
        expect(page.url()).toBe(editorUrl);

        // Escape closes the menu without side effects.
        await page.keyboard.press("Escape");
        await expect(menuButton(page, "Open link")).toHaveCount(0);
    });

    test("Ctrl+click follows the link on purpose and no menu appears", async ({ page }) => {
        await openExampleInEditor(page);
        const link = emailLink(page);
        await expect(link).toBeVisible();

        await link.click({ modifiers: ["Control"] });

        await page.waitForTimeout(350);
        await expect(menuButton(page, "Open link")).toHaveCount(0);
        await expect(menuButton(page, "Customize section")).toHaveCount(0);
    });

    test("a plain click on non-link content keeps the existing menu without Open link", async ({ page }) => {
        await openExampleInEditor(page);
        const name = page.locator('.resume-page [data-testid="resume-preview-name"]').first();
        await expect(name).toBeVisible();

        await name.click();

        await expect(menuButton(page, "Customize section")).toBeVisible();
        await expect(menuButton(page, "Open link")).toHaveCount(0);
    });
});

test.describe("editor preview headings", () => {
    test("double-clicking a section heading jumps to it without opening the menu", async ({ page }) => {
        await openExampleInEditor(page);
        const heading = page.locator('.resume-page [data-nav-kind="heading"][data-nav-section="experience"] h2').first();
        await expect(heading).toBeVisible();

        await heading.dblclick();

        // The sidebar opens the experience section editor (only it has "Remove Section").
        await expect(menuButton(page, "Remove Section")).toBeVisible();
        await expect(page.getByRole("textbox", { name: "Section Heading" })).toHaveValue("Professional Experience");
        await page.waitForTimeout(350);
        await expect(menuButton(page, "Customize section")).toHaveCount(0);
    });

    test("double-clicking entry text still starts inline editing instead of navigating", async ({ page }) => {
        await openExampleInEditor(page);
        const editable = page.locator('.resume-page [data-nav-kind="entry"] [data-editable-field]').first();
        await expect(editable).toBeVisible();

        await editable.dblclick();

        await expect(page.locator('.resume-page [contenteditable="true"], .resume-page textarea, .resume-page input').first()).toBeVisible();
        await expect(menuButton(page, "Customize section")).toHaveCount(0);
        await expect(menuButton(page, "Remove Section")).toHaveCount(0);
    });

    test("Alt+double-click on entry text jumps to that entry instead of editing inline", async ({ page }) => {
        await openExampleInEditor(page);
        const editable = page.locator('.resume-page [data-nav-section="experience"][data-nav-kind="entry"] [data-editable-field]').first();
        await expect(editable).toBeVisible();

        await editable.dblclick({ modifiers: ["Alt"] });

        await expect(page.getByRole("heading", { name: /^Edit entry in/ })).toBeVisible();
        await expect(page.locator('.resume-page [contenteditable="true"]')).toHaveCount(0);
        await expect(menuButton(page, "Customize section")).toHaveCount(0);
    });

    test("double-clicking the empty area of an entry jumps to that entry", async ({ page }) => {
        await openExampleInEditor(page);
        const entry = page.locator('.resume-page [data-nav-section="experience"][data-nav-kind="entry"]').first();
        await expect(entry).toBeVisible();
        const box = await entry.boundingBox();
        if (!box) throw new Error("entry not measurable");

        // The far right edge of the entry row is padding, not editable text.
        await page.mouse.dblclick(box.x + box.width - 2, box.y + box.height / 2);

        await expect(page.getByRole("heading", { name: /^Edit entry in/ })).toBeVisible();
    });
});

test.describe("going to an entry when an earlier entry is hidden", () => {
    test("double-click and Go to entry open the entry that was clicked, not the hidden one above it", async ({ page }) => {
        await openExampleInEditor(page);
        const entries = page.locator('.resume-page [data-nav-section="experience"][data-nav-kind="entry"]');
        const before = await entries.count();
        expect(before).toBeGreaterThan(1);

        // Open the first entry, remember what it is, and hide it.
        await entries.first().click();
        await menuButton(page, "Go to entry").click();
        const hiddenPosition = await page.getByTestId("entry-input-position").inputValue();
        expect(hiddenPosition).not.toBe("");
        await page.getByRole("button", { name: /Hide entry/ }).click();
        await expect(entries).toHaveCount(before - 1);
        await expect(page.locator(".resume-page")).not.toContainText(hiddenPosition);

        // The entry now shown first used to be the second one in the editor.
        await page.getByText("Back", { exact: true }).first().click();
        const shown = entries.first();
        const shownText = (await shown.innerText()).trim();
        await shown.locator("[data-editable-field]").first().dblclick({ modifiers: ["Alt"] });

        const opened = await page.getByTestId("entry-input-position").inputValue();
        expect(opened, "opened the hidden entry instead of the one clicked").not.toBe(hiddenPosition);
        expect(shownText).toContain(opened);

        // The click menu's "Go to entry" agrees.
        await page.getByText("Back", { exact: true }).first().click();
        await entries.first().click();
        await menuButton(page, "Go to entry").click();
        expect(await page.getByTestId("entry-input-position").inputValue()).toBe(opened);
    });
});
