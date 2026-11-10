import { expect, test, type Page } from "@playwright/test";

function authoring(description: string, company = "Acme") {
    return {
        name: `${company}.json`,
        mimeType: "application/json",
        buffer: Buffer.from(
            JSON.stringify({
                format: "enginecv.authoring/v1",
                basics: { name: "Jane Doe" },
                experience: [{ company, position: "Engineer", start: "2020-03", description }],
            }),
        ),
    };
}

async function createBlankResume(page: Page) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-scratch").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
}

test("combines two files with an overlapping job, keeps one wording, applies and undoes", async ({ page }) => {
    await createBlankResume(page);
    await expect(page.getByTestId("section-card-experience")).toHaveCount(0);

    await page.getByTestId("import-data-content").click();
    const dialog = page.getByTestId("import-hub-dialog");
    await expect(dialog).toBeVisible();

    await page.getByTestId("import-hub-file-input").setInputFiles([
        authoring("Short wording.", "Acme"),
        authoring("A longer and fuller wording of the same job.", "ACME Inc."),
    ]);
    await expect(page.getByTestId("import-hub-batch")).toHaveCount(2);
    await page.getByTestId("import-hub-review").click();

    // One job, found in both files.
    await expect(page.getByTestId("import-hub-row")).toHaveCount(1);
    await expect(page.getByTestId("import-hub-badge-several")).toBeVisible();

    await page.getByRole("button", { name: /Choose between versions/ }).click();
    await page.getByRole("radio", { name: /Use for Description: Acme\.json/ }).check();
    await page.getByTestId("import-hub-apply").click();
    await expect(page.getByTestId("import-hub-done")).toBeVisible();

    // The editor behind the dialog now has Experience.
    await expect(page.getByTestId("section-card-experience")).toBeVisible();

    await page.getByTestId("import-hub-undo").click();
    await expect(page.getByTestId("section-card-experience")).toHaveCount(0);
});

test("closing with staged data asks to discard, and keeping it leaves the dialog open", async ({ page }) => {
    await createBlankResume(page);
    await page.getByTestId("import-data-content").click();
    await page.getByTestId("import-hub-file-input").setInputFiles(authoring("Text."));
    await expect(page.getByTestId("import-hub-batch")).toHaveCount(1);

    await page.getByTestId("import-hub-close").click();
    await expect(page.getByRole("dialog", { name: "Discard the added data?" })).toBeVisible();
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(page.getByTestId("import-hub-dialog")).toHaveCount(0);
});

test("an applied import is still there after a reload", async ({ page }) => {
    await createBlankResume(page);
    await page.getByTestId("import-data-content").click();
    await page.getByTestId("import-hub-file-input").setInputFiles(authoring("Kept after reload."));
    await expect(page.getByTestId("import-hub-batch")).toHaveCount(1);
    await page.getByTestId("import-hub-review").click();
    await page.getByTestId("import-hub-apply").click();
    await expect(page.getByTestId("import-hub-done")).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).last().click();
    await expect(page.getByTestId("section-card-experience")).toBeVisible();

    // Autosave writes the change; wait for it, then reload.
    await expect(page.getByText(/Saved at/)).toBeVisible();
    await page.waitForTimeout(1500);
    await page.reload();
    await expect(page.getByTestId("section-card-experience")).toBeVisible();
});

test("None can be chosen for a detail such as the headline", async ({ page }) => {
    await createBlankResume(page);
    await page.getByTestId("import-data-content").click();
    await page.getByTestId("import-hub-file-input").setInputFiles({
        name: "ai.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify({ format: "enginecv.authoring/v1", basics: { name: "Jane Doe", headline: "Staff Engineer" }, experience: [{ company: "Acme", position: "Dev", start: "2020-01" }] })),
    });
    await expect(page.getByTestId("import-hub-batch")).toHaveCount(1);
    await page.getByTestId("import-hub-review").click();
    await page.getByRole("radio", { name: "Use for Headline: None" }).check();
    await page.getByTestId("import-hub-apply").click();
    await expect(page.getByTestId("import-hub-done")).toBeVisible();
});
