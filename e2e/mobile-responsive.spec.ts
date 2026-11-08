import { expect, test, type Page } from "@playwright/test";
import { showLandingDemo } from "./helpers/landing";
import { openJsonFixture } from "./helpers/json-editor";

test("JSON editor fits 360 px German layout", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await openJsonFixture(page);
    await page.evaluate(() => {
        const raw = JSON.parse(localStorage.getItem("enginecv-preferences")!);
        raw.preferences.appearance.locale = "de";
        localStorage.setItem("enginecv-preferences", JSON.stringify(raw));
    });
    await page.reload(); await page.getByTestId("sidebar-tab-json").first().click();
    await expect(page.getByRole("textbox", { name: "Lebenslauf-JSON" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Interne Felder ausblenden" })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: "tmp/json-editor-de-360.png", fullPage: true });
});

test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
});

async function createBlankResume(page: Page) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-scratch").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
}

async function expandCustomizeSection(page: Page, heading: string) {
    const sectionIds: Record<string, string> = {
        "Document Units": "documentUnits",
        "Spacing": "spacing",
    };
    const row = page.getByTestId(`customize-row-${sectionIds[heading]}`);
    if (!await row.isVisible()) {
        await page.getByRole("button", { name: "Whole resume" }).click();
    }
    await row.click();
}

test("landing page avoids horizontal overflow on mobile", async ({ page }) => {
    await page.goto("/");
    // "load", not "networkidle": third-party requests (e.g. ads) can keep the
    // network busy indefinitely. The showcase is the last layout-affecting block.
    await page.waitForLoadState("load");
    await showLandingDemo(page);

    const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);

    await page.locator("footer").scrollIntoViewIfNeeded();
    await expect(page.getByText("EngineCV").last()).toBeVisible();
});

test("landing template showcase stays usable without mobile overflow", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");

    await showLandingDemo(page);
    await page.getByTestId("landing-template-next").click();
    await expect(page.getByTestId("landing-template-counter")).toContainText(/\d+\/\d+/);

    const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
});

test("dashboard sidebar opens as a mobile drawer without overflow", async ({ page }) => {
    await page.goto("/dashboard?tab=templates");
    await page.getByRole("button", { name: "Toggle sidebar" }).click();

    await expect(page.getByTestId("dashboard-sidebar-nav").last()).toBeVisible();
    await expect(page.getByTestId("dashboard-sidebar-new-resume").last()).toBeVisible();
    await expect(page.getByLabel("Change language").last()).toBeVisible();
    await page.getByTestId("dashboard-sidebar-resumes").last().click();
    await expect(page.getByRole("heading", { name: "Your Resumes" })).toBeVisible();

    const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
});

test("dashboard template tabs and search stay usable on mobile", async ({ page }) => {
    await page.goto("/dashboard?tab=templates");

    await page.getByRole("button", { name: "Search templates..." }).click();
    await page.getByPlaceholder("Search templates...").last().fill("Developer");
    await expect(page.locator('[data-testid="templates-catalog-card"]').filter({ hasText: "Developer" })).toBeVisible();

    await page.locator('[data-testid="dashboard-template-filter"]:visible').click();
    await page.getByRole("button", { name: /Your Templates/ }).click();
    await expect(page.getByText('No saved templates match "Developer".')).toBeVisible();

    const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
});

test("mobile editor keeps customize dropdowns and language menu interactive", async ({ page }) => {
    await createBlankResume(page);

    await page.getByTestId("sidebar-tab-customize").click();
    await expandCustomizeSection(page, "Document Units");
    await page.getByTestId("measurement-system-select").click();
    await page.getByTestId("measurement-system-option-imperial").click();
    await expandCustomizeSection(page, "Spacing");
    await expect(page.getByTestId("spacing-margin-h-display")).toContainText("in");

    await page.getByRole("button", { name: "Open actions menu" }).click();
    const historyAction = page.getByRole("button", { name: "History" });
    await expect(historyAction).toBeVisible();
    await expect.poll(async () => historyAction.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return hit === element || element.contains(hit);
    })).toBe(true);

    const feedbackAction = page.getByRole("button", { name: "Send feedback" });
    await expect(feedbackAction).toBeVisible();
    await feedbackAction.click();
    await expect(page.getByRole("dialog", { name: "Send feedback" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("button", { name: "Open actions menu" }).click();
    await page.getByLabel("Change language").click();
    await expect(page.getByRole("button", { name: "Deutsch" })).toBeVisible();
});

// T065: German and Bosnian strings are the longest in the app, and 360px is the
// narrowest phone width worth supporting. Checks the surfaces added by 022.
const LONG_LOCALES = ["de", "bs"] as const;

async function useLocale(page: Page, locale: string) {
    await page.addInitScript((stored: string) => {
        window.localStorage.setItem("enginecv-locale", stored);
    }, locale);
}

/** Nothing may stick out sideways, and no element may be cut off by the viewport. */
async function expectNoOverflow(page: Page, testIds: string[]) {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, "page scroll width").toBeLessThanOrEqual(360);

    for (const testId of testIds) {
        const box = await page.getByTestId(testId).first().boundingBox();
        expect(box, testId).not.toBeNull();
        expect(box!.x, `${testId} left edge`).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width, `${testId} right edge`).toBeLessThanOrEqual(360);
    }
}

for (const locale of LONG_LOCALES) {
    test(`cookie page consent controls fit a 360px screen in ${locale}`, async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 740 });
        await useLocale(page, locale);
        await page.goto("/cookies");

        await expect(page.getByTestId("ad-consent-status")).toBeVisible();
        await expectNoOverflow(page, ["ad-consent-status"]);
    });

    test(`skip link fits a 360px screen in ${locale}`, async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 740 });
        await useLocale(page, locale);
        await page.goto("/");

        await page.keyboard.press("Tab");
        await expect(page.getByTestId("skip-link")).toBeFocused();
        await expectNoOverflow(page, ["skip-link"]);
    });
}

for (const locale of LONG_LOCALES) {
    test(`Your data page and delete dialog fit a 360px screen in ${locale}`, async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 740 });
        await useLocale(page, locale);
        await page.goto("/your-data");

        await expect(page.getByTestId("your-data-download")).toBeVisible();
        await expectNoOverflow(page, ["your-data-download", "your-data-delete"]);

        await page.getByTestId("your-data-delete").getByRole("button").click();
        await expect(page.getByTestId("delete-all-data-dialog")).toBeVisible();
        await expectNoOverflow(page, ["delete-all-data-dialog", "hold-to-delete"]);
    });
}
