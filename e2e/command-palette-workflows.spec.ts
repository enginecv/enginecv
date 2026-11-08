import { expect, test, type Page } from "@playwright/test";

async function createBlankResume(page: Page) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-scratch").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
}

async function openPalette(page: Page, query: string) {
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    const input = palette.getByRole("combobox");
    await input.fill(query);
    return { palette, input };
}

test("finds a nested command directly from root search", async ({ page }) => {
    await createBlankResume(page);

    const { palette } = await openPalette(page, "light");
    const lightTheme = palette.getByRole("option", {
        name: /^Light.*Preferences.*Theme/,
    });

    await expect(lightTheme).toBeVisible();
    await expect(lightTheme).toContainText(/Preferences.*Theme/);
    await lightTheme.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("searches resume content and opens the matching editor target", async ({ page }) => {
    await createBlankResume(page);
    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-name-input").fill("Safet Imamovic");
    await page.getByTestId("basics-summary-input").fill(
        "Built the Zephyr Observatory control system for distributed telescopes.",
    );
    await page.getByTestId("basics-form-back").click();

    const { palette, input } = await openPalette(page, "Zephyr Observatory");
    const result = palette.getByRole("option", { name: /Safet Imamovic/ });
    await expect(result).toBeVisible();
    await expect(result).toContainText("Zephyr Observatory");
    await input.press("Enter");

    await expect(page.getByTestId("basics-name-input")).toHaveValue("Safet Imamovic");
});

test("changes client preferences and persists a pinned command", async ({ page }) => {
    await createBlankResume(page);

    let { palette, input } = await openPalette(page, "preferences");
    await page.keyboard.press("Enter");
    await expect(input).toHaveAttribute("placeholder", /Search client preferences/);
    await expect(palette.getByText("Auto Save", { exact: true })).toBeVisible();
    await page.screenshot({
        path: "test-results/command-palette-preferences.png",
        fullPage: true,
    });

    await input.fill("command palette width");
    await page.keyboard.press("Enter");
    await input.fill("wide");
    await page.keyboard.press("Enter");
    await expect(palette).toHaveAttribute("data-width", "wide");

    await page.keyboard.press("Escape");
    await input.fill("command palette height");
    await page.keyboard.press("Enter");
    await input.fill("tall");
    await page.keyboard.press("Enter");
    await expect(palette).toHaveAttribute("data-height", "tall");

    await page.keyboard.press("Escape");
    await input.fill("auto save");
    await page.keyboard.press("Enter");
    await expect(palette.getByText("Off", { exact: true })).toBeVisible();

    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");

    ({ palette, input } = await openPalette(page, "manage pinned commands"));
    await page.keyboard.press("Enter");
    await input.fill("save");
    await palette.getByText("Save", { exact: true }).click();
    await expect(palette).toHaveCount(0);

    ({ palette, input } = await openPalette(page, "pinned commands"));
    await page.keyboard.press("Enter");
    await expect(palette.getByText("Save", { exact: true })).toBeVisible();
});

test("exports, imports, and resets versioned preferences", async ({ page }) => {
    await createBlankResume(page);

    let { palette, input } = await openPalette(page, "preferences");
    await page.keyboard.press("Enter");
    await input.fill("export preferences");
    const downloadPromise = page.waitForEvent("download");
    await page.keyboard.press("Enter");
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("enginecv-preferences.json");

    ({ palette, input } = await openPalette(page, "preferences"));
    await page.keyboard.press("Enter");
    await input.fill("import preferences");
    await page.keyboard.press("Enter");
    await page.getByTestId("preferences-file-input").setInputFiles({
        name: "enginecv-preferences.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify({
            kind: "enginecv.preferences",
            schemaVersion: 1,
            preferences: {
                commandPalette: {
                    width: "compact",
                    height: "compact",
                    pinnedCommandIds: [],
                    recentCommandIds: [],
                },
            },
        })),
    });

    const importDialog = page.getByRole("dialog", { name: "Import preferences?" });
    await expect(importDialog).toBeVisible();
    await importDialog.getByRole("button", { name: "Import", exact: true }).click();

    ({ palette, input } = await openPalette(page, "preferences"));
    await expect(palette).toHaveAttribute("data-width", "compact");
    await expect(palette).toHaveAttribute("data-height", "compact");
    await page.keyboard.press("Enter");
    await input.fill("reset preferences");
    await page.keyboard.press("Enter");

    const resetDialog = page.getByRole("dialog", { name: "Reset all preferences?" });
    await expect(resetDialog).toBeVisible();
    await resetDialog.getByRole("button", { name: "Reset", exact: true }).click();

    ({ palette } = await openPalette(page, "preferences"));
    await expect(palette).toHaveAttribute("data-width", "standard");
    await expect(palette).toHaveAttribute("data-height", "standard");
});

test("opens shared command tree at the top of the mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await createBlankResume(page);

    await page.getByRole("button", { name: "Open actions menu" }).click();
    await expect(page.getByText("Quick actions", { exact: true })).toBeVisible();
    await expect(page.getByText("Send feedback", { exact: true })).toBeVisible();
    await page.getByText("Quick actions", { exact: true }).click();

    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette).toHaveAttribute("data-variant", "sheet");
    await expect(palette).toHaveAttribute("data-placement", "top");
    const box = await palette.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.y ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
    await page.screenshot({
        path: "test-results/command-palette-mobile.png",
        fullPage: true,
    });
});
