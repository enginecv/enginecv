import { expect, test, type Page } from "@playwright/test";
import { openJsonFixture, savedResume } from "./helpers/json-editor";
import { createCvFromHub } from "./helpers/import-hub";
import { createQaFullResume } from "../src/lib/qa/sample-resumes";

// Interests display styles (feature 083). The QA fixture resume has interests,
// some with descriptions.

async function setStoredLocale(page: Page, locale: string) {
    await page.addInitScript((storedLocale: string) => {
        window.localStorage.setItem("enginecv-locale", storedLocale);
        document.cookie = `enginecv-locale=${storedLocale}; path=/`;
    }, locale);
}

/**
 * The style chosen from a section's own Customize panel is stored as a
 * per-section override (like the Languages section); otherwise it is in the CV
 * settings. This reads whichever applies.
 */
async function savedInterestsDisplay(page: Page) {
    const resume = await savedResume(page);
    return resume.customization?.sectionOverrides?.interests?.interestsSection?.display
        ?? resume.settings.interestsSection.display;
}

function interestsHeading(page: Page) {
    return page.locator('.resume-page [data-nav-kind="heading"][data-nav-section="interests"] h2').first();
}

function flow(page: Page) {
    return page.locator('.resume-page [data-testid="resume-interests-flow"]');
}

/** Opens the Interests style controls from the preview heading's Customize section menu. */
async function openInterestsCustomize(page: Page, customizeLabel = "Customize section") {
    await interestsHeading(page).scrollIntoViewIfNeeded();
    await interestsHeading(page).click();
    await page.getByRole("button", { name: customizeLabel, exact: true }).click();
    const row = page.getByTestId("customize-row-interestsSection");
    if (await row.isVisible().catch(() => false)) await row.click();
    await expect(page.getByTestId("interests-section-controls")).toBeVisible();
}

test.describe("interests display styles", () => {
    test("default look is the per-entry list, and each style switches the preview", async ({ page }) => {
        await openJsonFixture(page, false);
        await expect(interestsHeading(page)).toBeVisible();
        await expect(flow(page)).toHaveCount(0);

        await openInterestsCustomize(page);

        await page.getByTestId("interests-style-inline").click();
        await expect(flow(page)).toHaveAttribute("data-display", "inline");
        await page.getByTestId("interests-separator-pipe").click();
        await expect(flow(page)).toContainText("|");

        await page.getByTestId("interests-style-chips").click();
        await expect(flow(page)).toHaveAttribute("data-display", "chips");
        await expect(flow(page).getByTestId("resume-interest-item").first()).toBeVisible();

        await page.getByTestId("interests-style-iconGrid").click();
        await expect(flow(page)).toHaveAttribute("data-display", "iconGrid");
        await page.getByTestId("interests-columns-2").click();
        await expect(flow(page)).toHaveCSS("grid-template-columns", /^\d+(\.\d+)?px \d+(\.\d+)?px$/);

        await page.getByTestId("interests-style-list").click();
        await expect(flow(page)).toHaveCount(0);
    });

    test("tells the user that descriptions are hidden in the compact styles, and keeps them saved", async ({ page }) => {
        await openJsonFixture(page, false);
        await openInterestsCustomize(page);
        const before = await savedResume(page);
        const described = before.interests.filter((interest) => (interest.description || "").trim() !== "").length;
        expect(described).toBeGreaterThan(0);

        await expect(page.getByTestId("interests-descriptions-hidden")).toHaveCount(0);
        await page.getByTestId("interests-style-chips").click();
        await expect(page.getByTestId("interests-descriptions-hidden")).toBeVisible();

        // The descriptions are still in the saved data.
        await expect.poll(() => savedInterestsDisplay(page)).toBe("chips");
        const after = await savedResume(page);
        expect(after.interests.map((interest) => interest.description)).toEqual(before.interests.map((interest) => interest.description));
    });

    test("the chosen style survives a reload", async ({ page }) => {
        await openJsonFixture(page, false);
        await openInterestsCustomize(page);
        await page.getByTestId("interests-style-chips").click();
        await expect.poll(() => savedInterestsDisplay(page)).toBe("chips");

        await page.reload();

        await expect(flow(page)).toHaveAttribute("data-display", "chips");
    });

    test("German labels wrap instead of overflowing the style controls", async ({ page }) => {
        await setStoredLocale(page, "de");
        await openJsonFixture(page, false);
        await openInterestsCustomize(page, "Abschnitt anpassen");

        await page.getByTestId("interests-style-iconGrid").click();
        const controls = page.getByTestId("interests-section-controls");
        await expect(page.getByTestId("interests-style-iconGrid")).toContainText("Symbolraster");
        const overflow = await controls.evaluate((element) => element.scrollWidth - element.clientWidth);
        expect(overflow).toBeLessThanOrEqual(1);
        for (const id of ["list", "inline", "chips", "iconGrid"]) {
            const box = await page.getByTestId(`interests-style-${id}`).boundingBox();
            const container = await controls.boundingBox();
            expect(box && container && box.x + box.width <= container.x + container.width + 1).toBeTruthy();
        }
    });
});

test.describe("interest icons", () => {
    async function openInterestEntries(page: Page) {
        await openJsonFixture(page, false);
        await expect(interestsHeading(page)).toBeVisible();
        // The section card (reached from the heading menu) has no entry
        // list; an entry form opens from the preview menu's "Go to entry".
        const firstEntry = page.locator('.resume-page [data-nav-section="interests"][data-nav-kind="entry"]').first();
        await firstEntry.scrollIntoViewIfNeeded();
        await firstEntry.click();
        await page.getByRole("button", { name: "Go to entry", exact: true }).click();
        await expect(page.getByTestId("interest-icon-trigger").first()).toBeVisible();
    }

    async function firstInterestIcon(page: Page) {
        return (await savedResume(page)).interests[0]?.icon;
    }

    test("pick an icon by search, see it in the preview, type an emoji, then clear it", async ({ page }) => {
        await openInterestEntries(page);
        expect(await firstInterestIcon(page)).toBeUndefined();

        // Pick by search.
        await page.getByTestId("interest-icon-trigger").first().click();
        await page.getByTestId("interest-icon-search").fill("guitar");
        await page.getByTestId("interest-icon-option-guitar").click();
        await expect.poll(() => firstInterestIcon(page)).toBe("lucide:guitar");
        await expect(page.locator('.resume-page [data-testid="interest-icon-svg"]')).toHaveCount(1);

        // Type an emoji instead.
        await page.getByTestId("interest-icon-trigger").first().click();
        await page.getByTestId("interest-icon-emoji-input").fill("🎸");
        await expect.poll(() => firstInterestIcon(page)).toBe("🎸");
        await expect(page.locator('.resume-page [data-testid="interest-icon-emoji"]')).toHaveText("🎸");

        // Clear it.
        await page.getByTestId("interest-icon-clear").first().click();
        await expect.poll(() => firstInterestIcon(page)).toBeUndefined();
        await expect(page.locator('.resume-page [data-testid="interest-icon-svg"], .resume-page [data-testid="interest-icon-emoji"]')).toHaveCount(0);
    });

    test("an invalid emoji shows an error and saves nothing", async ({ page }) => {
        await openInterestEntries(page);

        await page.getByTestId("interest-icon-trigger").first().click();
        await page.getByTestId("interest-icon-emoji-input").fill("guitar");

        await expect(page.getByTestId("interest-icon-emoji-error")).toBeVisible();
        await page.waitForTimeout(300);
        expect(await firstInterestIcon(page)).toBeUndefined();
    });

    test("the icon appears in the icon grid and is kept when switching to a style without icons", async ({ page }) => {
        await openInterestEntries(page);
        await page.getByTestId("interest-icon-trigger").first().click();
        await page.getByTestId("interest-icon-search").fill("music");
        await page.getByTestId("interest-icon-option-music").click();
        await expect.poll(() => firstInterestIcon(page)).toBe("lucide:music");

        // Leave the entry editor before opening Customize from the preview menu.
        await page.getByText("Back", { exact: true }).first().click();
        await openInterestsCustomize(page);
        await page.getByTestId("interests-style-iconGrid").click();
        await expect(flow(page).locator('[data-testid="interest-icon-svg"]')).toHaveCount(1);

        await page.getByTestId("interests-style-inline").click();
        await expect(flow(page).locator('[data-testid="interest-icon-svg"]')).toHaveCount(0);
        expect(await firstInterestIcon(page)).toBe("lucide:music");
    });
});

/** Imports the fixture, exports it as the app does for PDF (HTML, then Chromium print) and returns the PDF as text. */
async function printedPdf(page: Page, fixture: ReturnType<typeof createQaFullResume>) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-import-resume-input").setInputFiles({
        name: "icons.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(fixture)),
    });
    await createCvFromHub(page);
    await expect(flow(page)).toHaveAttribute("data-display", "iconGrid");

    // Same route the app's PDF export prints: the exported HTML, rendered by
    // Chromium (the engine behind "Save as PDF").
    await page.getByTestId("export-menu-button").first().click();
    await page.getByTestId("export-format-html").click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-confirm-button").click();
    const stream = await (await downloadPromise).createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const html = Buffer.concat(chunks).toString("utf8");
    expect(html).toContain("resume-interests-flow");

    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    return { html, raw: pdf.toString("latin1") };
}

const imageObjects = (raw: string) => (raw.match(/\/Subtype\s*\/Image/g) ?? []).length;

test.describe("interest icons in the PDF", () => {
    function fixtureWith(icons: Array<string | undefined>) {
        const fixture = createQaFullResume();
        fixture.basics.photo = "";
        fixture.interests = fixture.interests.map((interest, index) => (
            icons[index] ? { ...interest, icon: icons[index] } : { ...interest, icon: undefined }
        ));
        fixture.settings.interestsSection = { ...fixture.settings.interestsSection, display: "iconGrid" };
        return fixture;
    }

    test("a catalog icon is drawn as vector paths (no extra image) and links still work", async ({ page }) => {
        const without = await printedPdf(page, fixtureWith([]));
        const withIcon = await printedPdf(page, fixtureWith(["lucide:guitar"]));

        expect(withIcon.html).toContain("lucide");
        // Link annotations survive (the CV has email, phone and web links).
        expect(withIcon.raw).toMatch(/\/Subtype\s*\/Link/);
        // An SVG icon adds no raster image to the PDF compared with no icon at all.
        expect(imageObjects(withIcon.raw)).toBe(imageObjects(without.raw));
    });
});

test.describe("interests offline and responsiveness", () => {
    test("switching styles works with no network once the page has loaded", async ({ page, context }) => {
        await openJsonFixture(page, false);
        await openInterestsCustomize(page);

        await context.setOffline(true);
        await page.getByTestId("interests-style-chips").click();
        await expect(flow(page)).toHaveAttribute("data-display", "chips");
        await page.getByTestId("interests-style-iconGrid").click();
        await expect(flow(page)).toHaveAttribute("data-display", "iconGrid");
        await context.setOffline(false);
    });

    test("switching style updates the preview without a long stall", async ({ page }) => {
        await openJsonFixture(page, false);
        await openInterestsCustomize(page);

        // Time several switches and keep the best: one slow frame on a loaded dev
        // server says nothing about the code, a consistently slow switch does.
        const timings: number[] = [];
        for (const style of ["chips", "inline", "iconGrid", "chips", "inline"]) {
            timings.push(await page.evaluate((target) => new Promise<number>((resolve) => {
                const root = document.querySelector(".resume-page")?.parentElement ?? document.body;
                const button = document.querySelector(`[data-testid="interests-style-${target}"]`) as HTMLElement;
                const start = performance.now();
                const observer = new MutationObserver(() => {
                    if (document.querySelector(`[data-testid="resume-interests-flow"][data-display="${target}"]`)) {
                        observer.disconnect();
                        resolve(performance.now() - start);
                    }
                });
                observer.observe(root, { subtree: true, childList: true, attributes: true });
                button.click();
            }), style));
        }

        const best = Math.min(...timings);
        // The dev server is unoptimised and shared; the production target is under
        // 100 ms for a typical CV. This bound only catches a pathological stall.
        console.log(`interests style switch (ms): ${timings.map((value) => Math.round(value)).join(", ")}`);
        expect(best).toBeLessThan(1500);
    });
});
