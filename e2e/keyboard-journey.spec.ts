import { expect, test, type Page } from "@playwright/test";

// Keyboard-only journey:
// no mouse input from landing to a downloaded export.

async function focusedTestId(page: Page) {
    return page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute("data-testid") ?? null);
}

/** Presses Tab (or Shift+Tab) until the element with `testId` has focus. */
async function tabTo(page: Page, testId: string, { shift = false, max = 120 } = {}) {
    for (let step = 0; step < max; step += 1) {
        if ((await focusedTestId(page)) === testId) return;
        await page.keyboard.press(shift ? "Shift+Tab" : "Tab");
    }
    throw new Error(`Could not reach [data-testid="${testId}"] with ${shift ? "Shift+Tab" : "Tab"} in ${max} presses`);
}

/** The focused element must show a focus indicator (outline or box-shadow ring). */
async function expectVisibleFocus(page: Page) {
    const focused = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        return element && element !== document.body
            ? `${element.tagName} ${element.getAttribute("data-testid") ?? ""}`
            : "nothing focused";
    });
    // Focus rings can animate in (transition-all), so poll instead of sampling once.
    await expect.poll(
        () => page.evaluate(() => {
            const element = document.activeElement as HTMLElement | null;
            if (!element || element === document.body) return false;
            const style = getComputedStyle(element);
            const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
            const ring = style.boxShadow !== "none";
            return outline || ring;
        }),
        `visible focus indicator on ${focused}`,
    ).toBe(true);
}

test("create, edit and export a resume with the keyboard only", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/");
    // Don't scroll to the demo: scrolling moves Chrome's Tab starting point.
    await expect(page.getByTestId("landing-demo-placeholder").or(page.getByTestId("landing-template-showcase")).first()).toBeVisible();

    // Skip link is the first stop and moves focus into the main landmark.
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("skip-link")).toBeFocused();
    await expect(page.getByTestId("skip-link")).toBeVisible();
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest("main, #main-content")))).toBe(true);

    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-new-resume")).toBeVisible();
    await tabTo(page, "dashboard-new-resume");
    await expectVisibleFocus(page);
    await page.keyboard.press("Enter");

    const createDialog = page.getByRole("dialog");
    await expect(createDialog).toBeVisible();
    await expect.poll(() => createDialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await tabTo(page, "create-resume-from-scratch", { max: 20 });
    await expectVisibleFocus(page);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);

    await expect(page.getByTestId("add-content-experience")).toBeVisible();
    await tabTo(page, "add-content-experience");
    await expectVisibleFocus(page);
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("entry-input-position")).toBeVisible();
    await tabTo(page, "entry-input-position", { max: 40 });
    await page.keyboard.type("Keyboard Engineer");
    await expect(page.locator(".resume-page").first().getByText("Keyboard Engineer")).toBeVisible();

    await tabTo(page, "export-menu-button", { shift: true, max: 200 });
    await expectVisibleFocus(page);
    await page.keyboard.press("Enter");

    const exportDialog = page.getByRole("dialog");
    await expect(exportDialog).toBeVisible();
    await tabTo(page, "export-format-json", { max: 30 });
    await page.keyboard.press("Enter");
    await tabTo(page, "export-confirm-button", { max: 30 });
    await expectVisibleFocus(page);
    const download = page.waitForEvent("download");
    await page.keyboard.press("Enter");
    expect((await download).suggestedFilename()).toMatch(/\.json$/);

    if (await exportDialog.isVisible()) {
        await page.keyboard.press("Escape");
        await expect(exportDialog).toBeHidden();
    }
    await expect.poll(() => focusedTestId(page)).toBe("export-menu-button");
});
