import { expect, test, type Locator, type Page } from "@playwright/test";
import { showLandingDemo } from "./helpers/landing";

async function expectNoHorizontalOverflow(page: Page) {
    const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
}

function parseCounter(text: string) {
    const match = /(\d+)\/(\d+)/.exec(text);
    expect(match).not.toBeNull();
    return {
        current: Number(match![1]),
        total: Number(match![2]),
    };
}

async function getExpectedTemplateDesign(
    preview: Locator,
) {
    const theme = await preview.getAttribute("data-template-theme");
    const accent = await preview.getAttribute("data-template-accent");
    expect(theme).toBeTruthy();
    expect(accent).toBeTruthy();
    return { theme: theme!, accent: accent! };
}

async function expectEditorUsesTemplateDesign(
    page: Page,
    expected: { theme: string; accent: string },
) {
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    await expect(page.getByTestId("resume-preview-page-1")).toBeVisible();
    const resumeId = new URL(page.url()).pathname.split("/").pop()!;
    const design = await page.evaluate(async (id) => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("EngineCVDatabase");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        return new Promise<{ theme: string; accent: string }>((resolve, reject) => {
            const transaction = database.transaction("resumes", "readonly");
            const request = transaction.objectStore("resumes").get(id);
            request.onsuccess = () => resolve({
                theme: request.result.settings.theme,
                accent: request.result.settings.colors.accent,
            });
            request.onerror = () => reject(request.error);
        });
    }, resumeId);

    expect(design).toEqual(expected);
}

test("landing template links route to the public template gallery", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation").getByRole("link", { name: "Templates" }).click();
    await expect(page).toHaveURL(/\/cv-templates$/);

    await page.goto("/");
    await page.locator("footer").scrollIntoViewIfNeeded();
    await page.locator("footer").getByRole("link", { name: "Templates" }).click();
    await expect(page).toHaveURL(/\/cv-templates$/);
});

test("blog links to the gallery, and the dashboard templates tab keeps its desktop layout", async ({ page }) => {
    await page.setViewportSize({ width: 1365, height: 900 });
    await page.goto("/blog");

    await page.getByRole("navigation").getByRole("link", { name: "Templates" }).click();
    await expect(page).toHaveURL(/\/cv-templates$/);

    await page.goto("/dashboard?tab=templates");
    await expect(page.getByTestId("dashboard-sidebar-nav")).toBeVisible();
    await expect(page.getByTestId("dashboard-sidebar-templates")).toHaveAttribute("data-active", "true");

    const cards = page.getByTestId("templates-catalog-card");
    await expect(cards.nth(2)).toBeVisible();

    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();
    const third = await cards.nth(2).boundingBox();

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(third).not.toBeNull();
    expect(Math.abs(first!.y - second!.y)).toBeLessThan(2);
    expect(Math.abs(first!.y - third!.y)).toBeLessThan(2);
    expect(second!.x).toBeGreaterThan(first!.x + first!.width * 0.8);
    expect(third!.x).toBeGreaterThan(second!.x + second!.width * 0.8);
});

test("hero selected template creates a resume with its design and opens the editor", async ({ page }) => {
    await page.goto("/");
    await showLandingDemo(page);

    const selectedSlide = page.locator('[data-selected="true"]');
    const selectedPreview = selectedSlide.getByTestId("landing-template-preview");
    const expectedDesign = await getExpectedTemplateDesign(selectedPreview);
    const useButton = selectedSlide.getByTestId("landing-template-use-button");

    await expect(useButton).toBeEnabled();
    await useButton.click();
    await expectEditorUsesTemplateDesign(page, expectedDesign);
});

test("dashboard Use template creates a resume with its design and opens the editor", async ({ page }) => {
    await page.goto("/dashboard?tab=templates");

    const firstCard = page.getByTestId("templates-catalog-card").first();
    const expectedDesign = await getExpectedTemplateDesign(
        firstCard.getByTestId("dashboard-template-preview"),
    );

    await firstCard.getByTestId("dashboard-template-use").click();
    await expectEditorUsesTemplateDesign(page, expectedDesign);
});

test("hero template showcase loops with previous and next controls", async ({ page }) => {
    await page.goto("/");
    await showLandingDemo(page);

    const counter = page.getByTestId("landing-template-counter");
    await expect(counter).toContainText(/Template \d+\/\d+/);

    const initial = parseCounter(await counter.innerText());
    expect(initial.current).toBe(1);
    expect(initial.total).toBeGreaterThan(1);

    await page.getByTestId("landing-template-previous").click();
    await expect(counter).toContainText(`Template ${initial.total}/${initial.total}`);

    await page.getByTestId("landing-template-next").click();
    await expect(counter).toContainText(`Template 1/${initial.total}`);

    await page.getByTestId("landing-template-next").click();
    await expect(counter).toContainText(`Template 2/${initial.total}`);

    await expect(page
        .locator('[data-selected="true"]')
        .getByTestId("landing-template-use-button"))
        .toBeEnabled();
});

test("hero showcase is beside the hero copy on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await showLandingDemo(page);

    const headlineBox = await page.getByTestId("hero-headline").boundingBox();
    const showcaseBox = await page.getByTestId("landing-template-showcase").boundingBox();

    expect(headlineBox).not.toBeNull();
    expect(showcaseBox).not.toBeNull();
    expect(showcaseBox!.x).toBeGreaterThan(headlineBox!.x + headlineBox!.width);
    await expectNoHorizontalOverflow(page);
});

for (const width of [390, 768, 1024]) {
    test(`landing template showcase avoids overflow at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/");

        await showLandingDemo(page);
        await page.getByTestId("landing-template-next").click();
        await expect(page.getByTestId("landing-template-counter")).toContainText(/\d+\/\d+/);
        await expectNoHorizontalOverflow(page);
    });
}

test("non-default locale keeps carousel counter and controls usable", async ({ page }) => {
    await page.addInitScript(() => {
        window.localStorage.setItem("enginecv-locale", "de");
        document.cookie = "enginecv-locale=de; path=/";
    });

    await page.setViewportSize({ width: 390, height: 900 });
    // The German landing page lives at /de; "/" stays English.
    await page.goto("/de");

    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await showLandingDemo(page);
    await expect(page.getByTestId("landing-template-counter")).toContainText(/Vorlage \d+\/\d+/);
    await expect(page.getByLabel("Naechste Vorlage")).toBeVisible();
    await page.getByLabel("Naechste Vorlage").click();
    await expect(page.getByTestId("landing-template-counter")).toContainText(/Vorlage \d+\/\d+/);
    await expectNoHorizontalOverflow(page);
});
