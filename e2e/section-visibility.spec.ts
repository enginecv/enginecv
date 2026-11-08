import { expect, test, type Page } from "@playwright/test";

async function createResumeWithExperience(page: Page) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-scratch").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);

    await page.getByTestId("add-content-experience").click();
    await page.getByTestId("entry-input-position").fill("Visible Role");
    await page.getByTestId("entry-input-company").fill("Acme Systems");
    await page.getByTestId("section-form-back").click();

    await expect(page.locator(".resume-page").first().getByText("Visible Role")).toBeVisible();
}

test("section card shows a live entry-count badge", async ({ page }) => {
    await createResumeWithExperience(page);

    await expect(page.getByTestId("section-count-experience")).toHaveText("1");
});

test("hiding a section removes it from the preview and persists across reload", async ({ page }) => {
    await createResumeWithExperience(page);

    await page.getByTestId("section-visibility-experience").click();

    const previewPage = page.locator(".resume-page").first();
    await expect(previewPage.getByText("Visible Role")).toHaveCount(0);
    await expect(previewPage.getByText("Experience", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("section-card-experience")).toBeVisible();

    await page.waitForTimeout(1_500); // allow autosave
    await page.reload();
    await expect(page.locator(".resume-page").first().getByText("Visible Role")).toHaveCount(0);
    await expect(page.getByTestId("section-card-experience")).toBeVisible();

    await page.getByTestId("section-visibility-experience").click();
    await expect(page.locator(".resume-page").first().getByText("Visible Role")).toBeVisible();
});

test("hiding one entry keeps its siblings in the preview", async ({ page }) => {
    await createResumeWithExperience(page);

    // add a second entry
    await page.getByTestId("section-edit-experience").click();
    await page.getByTestId("experience-meta-add-entry").click();
    await page.getByTestId("entry-input-position").last().fill("Hidden Role");
    await page.getByTestId("entry-input-company").last().fill("Shadow Co");
    await page.getByTestId("section-form-back").click();

    const previewPage = page.locator(".resume-page").first();
    await expect(previewPage.getByText("Hidden Role")).toBeVisible();

    await page.getByTestId("section-expand-experience").click();
    await page.getByTestId("entry-visibility-experience-1").click();

    await expect(previewPage.getByText("Hidden Role")).toHaveCount(0);
    await expect(previewPage.getByText("Visible Role")).toBeVisible();
    await expect(page.getByTestId("entry-row-experience-1")).toBeVisible();
});
