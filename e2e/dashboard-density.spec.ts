import { expect, test } from "@playwright/test";

test("density control changes the templates grid, not just resumes", async ({ page }) => {
    await page.goto("/dashboard?tab=templates");

    const builtinGrid = page.getByTestId("dashboard-builtin-template-grid");
    await expect(builtinGrid).toBeVisible();
    await expect(builtinGrid).toHaveClass(/xl:grid-cols-3/);

    await page.locator('button[title="Density: Compact"]:visible').click();
    await expect(builtinGrid).toHaveClass(/xl:grid-cols-4/);

    await page.locator('button[title="Density: Large"]:visible').click();
    await expect(builtinGrid).toHaveClass(/xl:grid-cols-2/);
});

test("density choice on the templates tab survives a reload", async ({ page }) => {
    await page.goto("/dashboard?tab=templates");

    await page.locator('button[title="Density: Compact"]:visible').click();
    await expect(page.getByTestId("dashboard-builtin-template-grid")).toHaveClass(/xl:grid-cols-4/);

    await page.reload();
    await expect(page.getByTestId("dashboard-builtin-template-grid")).toHaveClass(/xl:grid-cols-4/);
});
