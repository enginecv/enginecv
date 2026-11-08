import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y";

// Role example pages. Every test starts on a fresh
// browser context, so the dashboard is empty unless a test adds a resume.

async function pressEdit(page: Page) {
    const button = page.getByTestId("edit-example");
    await expect(button).toBeVisible();
    await button.click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/, { timeout: 20_000 });
}

test.describe("example page", () => {
    test("shows the CV text, tips, skills and links in the page", async ({ page }) => {
        await page.goto("/cv-examples/nurse");

        await expect(page.getByRole("heading", { level: 1 })).toContainText("Nurse CV Example");
        await expect(page.getByTestId("role-example-tips").getByRole("listitem")).toHaveCount(5);
        await expect(page.getByTestId("role-example-skills").getByRole("listitem").first()).toBeVisible();
        await expect(page.getByTestId("role-example-text")).toContainText("Amra Begović");
        await expect(page.getByRole("link", { name: /Template used/ })).toHaveAttribute("href", "/cv-templates/lebenslauf");
        await expect(page.getByTestId("role-example-preview").locator(".resume-page").first()).toBeVisible({ timeout: 20_000 });
        await expectNoA11yViolations(page, { include: ["[data-testid=role-example]"], label: "role example page" });
    });

    test("serves the CV text without running any script", async ({ request }) => {
        const html = await (await request.get("/cv-examples/software-developer")).text();
        expect(html).toContain("Emir Hadžić");
        expect(html).toContain("Cut page load from 4.1 s to 1.3 s");
        expect(html).toContain('<link rel="canonical" href="https://enginecv.app/cv-examples/software-developer"');
        expect(html).not.toContain('content="noindex');
    });

    test("German page is a noindex draft with the review notice", async ({ page, request }) => {
        await page.goto("/de/cv-examples/pflegefachkraft");
        await expect(page.getByRole("heading", { level: 1 })).toContainText("Lebenslauf Pflegefachkraft");
        await expect(page.getByTestId("role-example-draft-notice")).toBeVisible();
        await expect(page.getByTestId("role-example-text")).toContainText("Gesundheits- und Krankenpflegerin");

        const html = await (await request.get("/de/cv-examples/pflegefachkraft")).text();
        expect(html).toContain('<meta name="robots" content="noindex, follow"');
    });

    test("answers 404 for a slug of another language and for a language without examples", async ({ request }) => {
        expect((await request.get("/cv-examples/pflegefachkraft")).status()).toBe(404);
        expect((await request.get("/de/cv-examples/nurse")).status()).toBe(404);
        expect((await request.get("/fr/cv-examples/nurse")).status()).toBe(404);
    });

    for (const path of ["/cv-examples/nurse", "/de/cv-examples/pflegefachkraft"]) {
        test(`fits a 360 px screen: ${path}`, async ({ page }) => {
            await page.setViewportSize({ width: 360, height: 740 });
            await page.goto(path);
            await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
            await expect(page.getByTestId("edit-example")).toBeVisible();

            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
            expect(overflow).toBeLessThanOrEqual(0);
        });
    }
});

test.describe("index", () => {
    test("lists the published roles by field and opens one", async ({ page }) => {
        await page.goto("/cv-examples");

        await expect(page.getByRole("heading", { level: 1, name: "CV examples by job" })).toBeVisible();
        await expect(page.getByTestId("role-group-tech").getByTestId("role-example-card")).toHaveCount(7);
        await expect(page.getByTestId("role-group-care").getByTestId("role-example-card")).toHaveCount(1);
        await expect(page.getByRole("link", { name: "Pflegefachkraft" })).toHaveCount(0);
        await expectNoA11yViolations(page, { include: ["main"], label: "role examples index" });

        await page.getByRole("link", { name: "Nurse", exact: true }).click();
        await expect(page).toHaveURL(/\/cv-examples\/nurse$/);
        await page.getByRole("link", { name: "All CV examples" }).click();
        await expect(page).toHaveURL(/\/cv-examples$/);
    });

    test("fits a 360 px screen", async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 740 });
        await page.goto("/cv-examples");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.getByTestId("role-example-card").first()).toBeVisible();

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    });

    test("is reachable from the template gallery, the resources page and the footer", async ({ page }) => {
        await page.goto("/cv-templates");
        await expect(page.getByTestId("gallery-examples-link")).toHaveAttribute("href", "/cv-examples");

        await page.goto("/resources");
        await expect(page.getByRole("link", { name: "See CV examples for popular jobs" })).toHaveAttribute("href", "/cv-examples");

        await page.goto("/cv-templates");
        await expect(page.getByRole("contentinfo").getByRole("link", { name: "CV examples" })).toHaveAttribute("href", "/cv-examples");
    });

    test("is not linked or served in a language without published examples", async ({ page, request }) => {
        for (const path of ["/de/cv-examples", "/bs/cv-examples", "/fr/cv-examples", "/es/cv-examples"]) {
            expect((await request.get(path)).status(), path).toBe(404);
        }
        await page.goto("/de/cv-templates");
        await expect(page.getByTestId("gallery-examples-link")).toHaveCount(0);
        await page.goto("/de/resources");
        await expect(page.locator('a[href$="/cv-examples"]')).toHaveCount(0);
    });

    test("is listed in the sitemap", async ({ request }) => {
        const xml = await (await request.get("/sitemap.xml")).text();
        expect(xml).toContain("https://enginecv.app/cv-examples<");
        expect(xml).not.toContain("/de/cv-examples<");
    });
});

test.describe("draft gate", () => {
    test("sitemap lists published examples and leaves out drafts", async ({ request }) => {
        const xml = await (await request.get("/sitemap.xml")).text();

        expect(xml).toContain("https://enginecv.app/cv-examples/nurse<");
        expect(xml).toContain("https://enginecv.app/cv-examples/software-developer<");
        expect(xml).not.toContain("/de/cv-examples/pflegefachkraft");
        expect(xml).not.toContain("/de/cv-examples/softwareentwickler");
    });

    test("a draft stays reachable but declares no alternates, and its published sibling does not point at it", async ({ request }) => {
        const draft = await request.get("/de/cv-examples/softwareentwickler");
        expect(draft.status()).toBe(200);
        const draftHtml = await draft.text();
        expect(draftHtml).toContain('<meta name="robots" content="noindex, follow"');
        expect(draftHtml).not.toContain('hrefLang="en"');

        const published = await (await request.get("/cv-examples/software-developer")).text();
        expect(published).not.toContain("softwareentwickler");
        expect(published).not.toContain('hrefLang="de"');
    });
});

test.describe("edit this example", () => {
    test("opens the editor on a copy and lists it on the dashboard", async ({ page }) => {
        await page.goto("/cv-examples/nurse");
        await pressEdit(page);
        await expect(page.locator(".resume-page").first().getByText("Amra Begović").first()).toBeVisible();

        await page.goto("/dashboard");
        await expect(page.getByText("Example – Nurse").first()).toBeVisible();
    });

    test("a German page copies the German CV", async ({ page }) => {
        await page.goto("/de/cv-examples/pflegefachkraft");
        await pressEdit(page);
        await expect(page.locator(".resume-page").first().getByText("Intensivstation").first()).toBeVisible();
    });

    test("every visit makes a new copy and leaves the first untouched", async ({ page }) => {
        await page.goto("/cv-examples/software-developer");
        await pressEdit(page);
        await page.goto("/cv-examples/software-developer");
        await pressEdit(page);

        await page.goto("/dashboard");
        await expect(page.getByText("Example – Software Developer")).toHaveCount(2);
    });

    test("makes the local copy with the network offline once the page has loaded", async ({ page, context }) => {
        await page.goto("/cv-examples/nurse");
        await expect(page.getByTestId("edit-example")).toBeVisible();
        // Let the example's content finish loading, then cut the network.
        await page.waitForLoadState("networkidle");
        await context.setOffline(true);
        await page.getByTestId("edit-example").click();
        // Opening the editor follows the app's own offline behaviour (#71); the copy itself needs no network.
        await expect(page.getByTestId("edit-example-error")).toHaveCount(0);
        await page.waitForTimeout(1_500);
        await context.setOffline(false);

        await page.goto("/dashboard");
        await expect(page.getByText("Example – Nurse").first()).toBeVisible();
    });
});
