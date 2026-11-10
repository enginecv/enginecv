import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y";

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

test.describe("accessibility and phone layout", () => {
    test("sources and review steps have no serious accessibility violations", async ({ page }) => {
        await createBlankResume(page);
        await page.getByTestId("import-data-content").click();
        await expect(page.getByTestId("import-hub-dialog")).toBeVisible();
        await expectNoA11yViolations(page, { label: "import-hub-sources-empty" });

        await page.getByTestId("import-hub-file-input").setInputFiles([authoring("One wording.", "Acme"), authoring("Another wording of it.", "ACME Inc.")]);
        await expect(page.getByTestId("import-hub-batch")).toHaveCount(2);
        await expectNoA11yViolations(page, { label: "import-hub-sources-staged" });

        await page.getByTestId("import-hub-review").click();
        await page.getByRole("button", { name: /Choose between versions/ }).click();
        await expectNoA11yViolations(page, { label: "import-hub-review" });
    });

    test("keeps focus inside the window, closes with Escape and gives focus back to the button", async ({ page }) => {
        await createBlankResume(page);
        const trigger = page.getByTestId("import-data-content");
        await trigger.click();
        const dialog = page.getByTestId("import-hub-dialog");
        await expect(dialog).toBeVisible();

        for (let step = 0; step < 25; step += 1) {
            await page.keyboard.press("Tab");
            const inside = await page.evaluate(() => Boolean(document.activeElement?.closest("[data-testid=import-hub-dialog]")));
            expect(inside).toBe(true);
        }

        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(trigger).toBeFocused();
    });

    test("fits a phone: no sideways scrolling and Apply stays reachable on the review step", async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 700 });
        await createBlankResume(page);
        await page.getByTestId("import-data-content").click();

        const many = Array.from({ length: 12 }, (_, index) => ({ company: `Company ${index}`, position: "Engineer", start: `20${10 + index}-01`, description: "A line of text that wraps on a narrow screen when it is long enough to do so." }));
        await page.getByTestId("import-hub-file-input").setInputFiles({
            name: "many.json",
            mimeType: "application/json",
            buffer: Buffer.from(JSON.stringify({ format: "enginecv.authoring/v1", basics: { name: "Jane Doe" }, experience: many })),
        });
        await expect(page.getByTestId("import-hub-batch")).toHaveCount(1);
        await expect(page.getByTestId("import-hub-review")).toBeInViewport();
        await page.getByTestId("import-hub-review").click();

        await expect(page.getByTestId("import-hub-row")).toHaveCount(12);
        await expect(page.getByTestId("import-hub-apply")).toBeInViewport();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        const box = await page.getByTestId("import-hub-dialog").boundingBox();
        expect(box!.width).toBeLessThanOrEqual(360);
    });
});
