import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, expectTheme, setTheme } from "./helpers/a11y";
import { showLandingDemo } from "./helpers/landing";
import { openJsonFixture } from "./helpers/json-editor";

for (const theme of ["light", "dark"] as const) test(`JSON editor and cleanup dialog are accessible in ${theme}`, async ({ page }) => {
    await setTheme(page, theme);
    await openJsonFixture(page);
    await expectNoA11yViolations(page, { include: ['[data-testid="json-editor-panel"]'], label: "json-editor" });
    await page.getByRole("button", { name: "Clean up" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoA11yViolations(page, { include: ['[role="dialog"]'], label: "json-editor-cleanup" });
    await page.getByRole("button", { name: "Dismiss" }).click();
});

// WCAG 2.1 AA scans (serious/critical violations fail) over the surfaces in
// the accessibility quality gate, in both themes.

async function createResume(page: Page) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-scratch").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    await expect(page.getByTestId("add-content-experience")).toBeVisible();
}

for (const theme of ["dark", "light"] as const) {
    test.describe(`${theme} theme`, () => {
        test.beforeEach(async ({ page }) => {
            await setTheme(page, theme);
        });

        test("landing page", async ({ page }) => {
            await page.goto("/");
            await expectTheme(page, theme);
            await showLandingDemo(page);
            await expectNoA11yViolations(page, { label: `${theme}-landing` });
        });

        test("dashboard, empty and with a resume", async ({ page }) => {
            await page.goto("/dashboard");
            await expectTheme(page, theme);
            await expect(page.getByTestId("dashboard-new-resume")).toBeVisible();
            await expectNoA11yViolations(page, { label: `${theme}-dashboard-empty` });

            await createResume(page);
            await page.goto("/dashboard");
            await expect(page.locator('[data-testid="dashboard-resume-card"]').first()).toBeVisible();
            await expectNoA11yViolations(page, { label: `${theme}-dashboard-with-resume` });
        });

        test("editor content, entry form and customize panel", async ({ page }) => {
            await createResume(page);
            await expectTheme(page, theme);
            await expectNoA11yViolations(page, { label: `${theme}-editor-content` });

            await page.getByTestId("add-content-experience").click();
            await expect(page.getByTestId("entry-input-position")).toBeVisible();
            await expectNoA11yViolations(page, { label: `${theme}-editor-entry-form` });
            await page.getByTestId("section-form-back").click();

            await page.getByTestId("sidebar-tab-customize").click();
            await expect(page.getByTestId("customize-row-templates")).toBeVisible();
            await expectNoA11yViolations(page, { label: `${theme}-editor-customize` });
        });

        test("export dialog", async ({ page }) => {
            await createResume(page);
            await page.getByTestId("export-menu-button").first().click();
            await page.getByTestId("export-format-docx").click();
            await expect(page.getByTestId("export-confirm-button")).toBeVisible();
            await expectNoA11yViolations(page, { label: `${theme}-export-dialog` });
        });

        test("Europass import dialog", async ({ page }) => {
            await page.goto("/dashboard");
            await page.getByTestId("dashboard-new-resume").click();
            await page.getByTestId("create-resume-from-europass").click();
            await expect(page.getByTestId("import-hub-dropzone")).toBeVisible();
            await expectNoA11yViolations(page, { label: `${theme}-europass-dialog` });
        });

        test("delete all my data dialog, locked and unlocked", async ({ page }) => {
            await page.goto("/your-data?action=delete");
            const dialog = page.getByTestId("delete-all-data-dialog");
            await expect(dialog.getByTestId("delete-counts")).toBeVisible();
            await expectNoA11yViolations(page, { label: `${theme}-delete-dialog` });
            await dialog.getByRole("textbox").fill("DELETE");
            await expectNoA11yViolations(page, { label: `${theme}-delete-dialog-unlocked` });
        });

        test("Paste from AI dialog, empty and with notes", async ({ page }) => {
            await page.goto("/dashboard?start=ai");
            await expect(page.getByTestId("import-hub-dialog")).toBeVisible();
            await expectNoA11yViolations(page, { label: `${theme}-paste-from-ai-empty` });

            await page.getByTestId("paste-from-ai-input").fill(
                "Here you go:\n```json\n{\"basics\":{\"name\":\"A\",\"photo\":\"x\"},"
                + "\"experience\":[{\"position\":\"P\",\"start\":\"spring 2021\",\"end\":\"heute\",}],\"hobbies\":[\"Chess\"]}\n```",
            );
            await page.getByTestId("paste-from-ai-add").click();
            await expect(page.getByTestId("paste-from-ai-notice").first()).toBeVisible();
            await expectNoA11yViolations(page, { label: `${theme}-paste-from-ai-notices` });
        });

        for (const route of ["/privacy", "/cookies", "/your-data", "/accessibility", "/blog"]) {
            test(`page ${route}`, async ({ page }) => {
                await page.goto(route);
                await expectTheme(page, theme);
                await expect(page.locator("h1").first()).toBeVisible();
                await expectNoA11yViolations(page, { label: `${theme}-${route.slice(1)}` });
            });
        }
    });
}
