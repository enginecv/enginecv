import { expect, test } from "@playwright/test";
import { openJsonFixture as openFixture, replaceJsonDocument as replaceDocument, savedResume } from "./helpers/json-editor";

test("edit → apply → form/preview → undo", async ({ page }) => {
    const original = await openFixture(page);
    const value = JSON.parse(JSON.stringify(original));
    value.basics.photo = "enginecv:photo";
    value.experience[0].position = "JSON Architect";
    [value.experience[0], value.experience[1]] = [value.experience[1], value.experience[0]];
    await replaceDocument(page, JSON.stringify(value, null, 2));
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(page.getByRole("button", { name: "Undo apply" })).toBeVisible();
    await page.getByTestId("sidebar-tab-content").first().click();
    await expect(page.locator("text=JSON Architect >> visible=true").first()).toBeVisible();
    const entry = page.getByTestId("entry-row-experience-1");
    if (!await entry.isVisible()) await page.getByTestId("section-expand-experience").click();
    await entry.click();
    await expect(page.locator('input[value="JSON Architect"]')).toBeVisible();
    await page.keyboard.press("ControlOrMeta+Shift+J");
    await page.getByRole("button", { name: "Undo apply" }).click();
    const { updatedAt, ...before } = original; void updatedAt;
    await expect.poll(async () => { const { updatedAt, ...value } = await savedResume(page); void updatedAt; return value; }).toEqual(before);
});

test("switching away from unapplied edits asks to discard", async ({ page }) => {
    await openFixture(page);
    const editor = page.getByRole("textbox", { name: "CV JSON" });
    await editor.click(); await editor.press("ControlOrMeta+End"); await editor.press("Enter");
    await page.getByTestId("sidebar-tab-content").first().click();
    await expect(page.getByRole("dialog", { name: "Discard unapplied JSON edits?" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(editor).toBeVisible();
});

test("messy whole-document paste → cleanup review → apply", async ({ page, context }) => {
    const original = await openFixture(page);
    original.experience[0].start = "March 2022";
    original.basics.photo = "enginecv:photo";
    const messy = "Here is your CV:\n```json\n" + JSON.stringify(original, null, 2).replace("{", "{\n// CV").replace('"basics"', "“basics”").replace(/\n}$/, ",\n}") + "\n```";
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.evaluate(text => navigator.clipboard.writeText(text), messy);
    const editor = page.getByRole("textbox", { name: "CV JSON" });
    await editor.click(); await editor.press("ControlOrMeta+a"); await editor.press("ControlOrMeta+v");
    const review = page.getByRole("dialog", { name: "Review cleanup" });
    await expect(review).toContainText("Replaced curly quotes");
    await expect(review).toContainText("2022-03");
    await page.getByRole("button", { name: "Accept cleanup" }).click();
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect.poll(async () => (await savedResume(page)).experience[0].start).toBe("2022-03");
});

test("Vim persists; motions, :w and dirty :q", async ({ page }) => {
    await openFixture(page);
    await page.getByRole("button", { name: "Vim", exact: true }).click();
    await expect(page.getByText("NORMAL", { exact: true })).toBeVisible();
    await page.reload(); await page.getByTestId("sidebar-tab-json").first().click();
    await expect(page.getByRole("button", { name: "Vim", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("NORMAL", { exact: true })).toBeVisible();
    const editor = page.getByRole("textbox", { name: "CV JSON" });
    await editor.click(); await page.keyboard.type("i");
    await expect(page.getByText("INSERT", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("NORMAL", { exact: true })).toBeVisible();
    await expect(editor).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(editor).toBeFocused();
    await page.keyboard.type("gg0");
    await page.screenshot({ path: "tmp/json-editor-vim-desktop.png", style: "nextjs-portal { display: none; }" });
    await editor.click(); await page.keyboard.type("ggddp");
    await page.keyboard.type("v"); await expect(page.getByText("VISUAL", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape"); await expect(editor).toBeVisible();
    await expect(page.getByText("NORMAL", { exact: true })).toBeVisible();
    await expect(editor).toBeFocused();
    await page.keyboard.type(":q"); await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Discard unapplied JSON edits?" })).toBeVisible();
    await page.getByRole("button", { name: "Discard edits" }).click();
    await page.getByTestId("sidebar-tab-json").first().click();
    // Trailing whitespace is a no-op save: no dialog, buffer clean, Content opens directly.
    await editor.click(); await page.keyboard.type("Go "); await page.keyboard.press("Escape");
    await page.keyboard.type(":w"); await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByTestId("sidebar-tab-content").first().click();
    await expect(page.getByTestId("sidebar-tab-content").first()).toHaveAttribute("aria-pressed", "true");
});

test("Vim :wq closes only after confirmed persistence", async ({ page }) => {
    const value = await openFixture(page); value.meta.title += " JSON"; value.basics.photo = "enginecv:photo";
    await replaceDocument(page, JSON.stringify(value, null, 2));
    await page.getByRole("button", { name: "Vim", exact: true }).click();
    await expect(page.getByText("NORMAL", { exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: "CV JSON" }).click(); await page.keyboard.type(":wq"); await page.keyboard.press("Enter");
    await expect(page.getByTestId("sidebar-tab-content").first()).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await savedResume(page)).meta.title).toBe(value.meta.title);
    await page.getByTestId("sidebar-tab-json").first().click(); await expect(page.getByRole("button", { name: "Undo apply" })).toBeVisible();
});

test("Vim keeps focus through insert edits, Escape and :w", async ({ page }) => {
    const original = await openFixture(page);
    await page.getByRole("button", { name: "Vim", exact: true }).click();
    await expect(page.getByText("NORMAL", { exact: true })).toBeVisible();
    const editor = page.getByRole("textbox", { name: "CV JSON" });
    await editor.click();
    // Find an existing string so typing changes valid JSON, not its structure.
    await page.keyboard.type("gg/meta");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/title");
    await page.keyboard.press("Enter");
    await page.keyboard.type('f:llli');
    await expect(page.getByText("INSERT", { exact: true })).toBeVisible();
    await page.keyboard.type("Vim edit ");
    await page.keyboard.press("Escape");
    await expect(page.getByText("NORMAL", { exact: true })).toBeVisible();
    await expect(editor).toBeFocused();
    await page.keyboard.type(":w");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect.poll(async () => (await savedResume(page)).meta.title).toBe(`Vim edit ${original.meta.title}`);
    await expect(editor).toBeFocused();
    await page.keyboard.type("i");
    await expect(page.getByText("INSERT", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(editor).toBeFocused();
});

test("JSON chunk failure keeps Content working and can be retried", async ({ page }) => {
    await openFixture(page, false);
    let blocked = true;
    await page.route(/\/_next\/static\/chunks\/.*src_components_editor_json.*\.js(?:\?|$)/, route => blocked ? route.abort() : route.continue());
    await page.getByTestId("sidebar-tab-json").first().click();
    await expect(page.getByRole("alert").filter({ hasText: "The JSON editor could not load" })).toBeVisible();
    await page.getByTestId("sidebar-tab-content").first().click();
    await expect(page.getByTestId("sidebar-tab-content").first()).toHaveAttribute("aria-pressed", "true");
    blocked = false;
    await page.getByTestId("sidebar-tab-json").first().click(); await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "CV JSON" })).toBeVisible();
});

test("Ctrl+S applies in On save mode; Live mode updates the CV as you type", async ({ page }) => {
    const value = await openFixture(page); value.meta.title += " shortcut"; value.basics.photo = "enginecv:photo";
    await replaceDocument(page, JSON.stringify(value, null, 2));
    await page.getByRole("textbox", { name: "CV JSON" }).press("ControlOrMeta+s");
    await expect.poll(async () => (await savedResume(page)).meta.title).toBe(value.meta.title);
    await expect(page.getByRole("button", { name: "Undo apply" })).toBeVisible();
    await page.getByRole("button", { name: "Live", exact: true }).click();
    await expect(page.getByRole("button", { name: "Apply", exact: true })).toHaveCount(0);
    value.meta.title += " live";
    await replaceDocument(page, JSON.stringify(value, null, 2));
    await expect.poll(async () => (await savedResume(page)).meta.title).toBe(value.meta.title);
});
