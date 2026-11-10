import { expect, test, type Page } from "@playwright/test";

async function createBlankResume(page: Page) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-scratch").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
}

async function openContentCommands(page: Page) {
    await page.keyboard.press("Control+k");
    const input = page.locator("[cmdk-input]");
    await input.fill("content");
    await page.keyboard.press("Enter");
    await expect(input).toHaveAttribute("placeholder", "Search content types…");
    return input;
}

test("content commands open configured sections and explicitly add missing sections", async ({ page }) => {
    await createBlankResume(page);

    let input = await openContentCommands(page);
    let palette = page.getByRole("dialog");
    await expect(palette.getByText("On resume", { exact: true })).toBeVisible();
    await expect(palette.getByText("Available", { exact: true })).toBeVisible();

    await input.fill("education");
    const addEducation = palette.getByRole("option", { name: /Add Education.*Not added/i });
    await expect(addEducation).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: /Edit entry in Education/i })).toBeVisible();
    await page.getByTestId("section-form-back").click();
    await expect(page.getByTestId("section-card-education")).toBeVisible();

    input = await openContentCommands(page);
    palette = page.getByRole("dialog");
    await input.fill("education");
    await expect(palette.getByRole("option", { name: /^Education\b/ })).toBeVisible();
    await expect(palette.getByText("Not added", { exact: true })).toHaveCount(0);
    await page.keyboard.press("Enter");

    await expect(
        page.getByTestId("editor-sidebar").getByRole("heading", { name: "Education", exact: true }),
    ).toBeVisible();
});

test("mobile content overview keeps present and available commands readable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await createBlankResume(page);

    await expect(page.getByPlaceholder("Search content types")).toBeVisible();
    await expect(page.getByText("On resume", { exact: true })).toBeVisible();
    await expect(page.getByText("Available", { exact: true })).toBeVisible();
    await expect(page.getByTestId("add-content-experience")).toContainText("Add Professional Experience");
    await expect(page.getByTestId("import-data-content")).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
});
