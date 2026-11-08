import { expect, test, type Page } from "@playwright/test";
import { zipSync } from "fflate";
import { candidateXml, europassPdf } from "../src/lib/import/europass/__fixtures__/europass-fixtures";
import { canonicalCsvEntries } from "../src/lib/import/linkedin/__fixtures__/canonical";
import { expectNoA11yViolations } from "./helpers/a11y";
import { mockGithubHappyPath } from "./helpers/github-mocks";

/** Aborts and records every request that leaves the app's own origin. */
async function recordExternalRequests(page: Page) {
    const external: string[] = [];
    await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
            await route.continue();
            return;
        }
        external.push(`${route.request().method()} ${url.href}`);
        await route.abort();
    });
    return external;
}

async function dropEuropassPdf(page: Page) {
    await page.getByTestId("europass-file-input").setInputFiles({
        name: "Europass CV.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(europassPdf(candidateXml())),
    });
}

test.describe("tools index", () => {
    test("lists the live tools and links to them", async ({ page }) => {
        await page.goto("/tools");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("Free CV tools");
        await page.getByTestId("tools-index").getByRole("link", { name: /Europass/ }).click();
        await expect(page).toHaveURL(/\/tools\/europass-to-cv$/);
        await expectNoA11yViolations(page, { label: "tools-index-to-europass" });
    });

    test("is linked from the footer in the page's language", async ({ page }) => {
        await page.goto("/de/cv-templates");
        await expect(page.getByRole("contentinfo").getByRole("link", { name: "Kostenlose Tools" })).toHaveAttribute("href", "/de/tools");
    });
});

test.describe("Europass tool page", () => {
    test("turns a dropped Europass PDF into a CV in the editor without leaving the browser", async ({ page }) => {
        const external = await recordExternalRequests(page);
        await page.goto("/tools/europass-to-cv");

        await dropEuropassPdf(page);
        await expect(page.getByTestId("europass-preview-profile")).toContainText("Amina Kovačević");
        await page.getByTestId("europass-import-confirm").click();

        await expect(page).toHaveURL(/\/editor\/[^/]+$/, { timeout: 30_000 });
        await expect(page.locator(".resume-page").first().getByText("Amina Kovačević").first()).toBeVisible();
        expect(external).toEqual([]);
    });

    test("opens the editor in German when the import starts on the German page", async ({ page }) => {
        await page.goto("/de/tools/europass-to-cv");
        await dropEuropassPdf(page);
        await page.getByTestId("europass-import-confirm").click();

        await expect(page).toHaveURL(/\/editor\/[^/]+$/, { timeout: 30_000 });
        await expect(page.locator("html")).toHaveAttribute("lang", "de");
    });

    test("server-renders the German page with its own title, canonical, hreflang and structured data", async ({ request }) => {
        const response = await request.get("/de/tools/europass-to-cv");
        expect(response.status()).toBe(200);
        const html = await response.text();

        expect(html).toContain('<html lang="de"');
        expect(html).toContain("<title>Europass-Lebenslauf bearbeiten und modernisieren, kostenlos | EngineCV</title>");
        expect(html).toMatch(/<link rel="canonical" href="[^"]*\/de\/tools\/europass-to-cv"/);
        expect(html.match(/<link rel="alternate" hrefLang=/g)).toHaveLength(6);
        expect(html).toContain('"@type":"FAQPage"');
        expect(html).toContain('"@type":"BreadcrumbList"');
        // The explanation and FAQ are in the HTML, not only in the client tool.
        expect(html).toContain("Warum heißt es, mein PDF enthalte keine Europass-Daten?");
    });

    test("passes axe and fits a 360px screen in German", async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 800 });
        await page.goto("/de/tools/europass-to-cv");
        await expect(page.getByTestId("europass-drop-zone")).toBeVisible();

        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
        await expectNoA11yViolations(page, { label: "europass-tool-de-360" });
    });
});

test.describe("LinkedIn tool page", () => {
    test("turns a dropped LinkedIn export into a CV in the editor without leaving the browser", async ({ page }) => {
        const external = await recordExternalRequests(page);
        await page.goto("/tools/linkedin-to-cv");

        const encoder = new TextEncoder();
        const files = Object.fromEntries(Object.entries(canonicalCsvEntries()).map(([name, text]) => [
            `Basic_LinkedInDataExport_01-01-2026/${name}`,
            encoder.encode(text),
        ]));
        await page.getByTestId("linkedin-file-input").setInputFiles({
            name: "Basic_LinkedInDataExport.zip",
            mimeType: "application/zip",
            buffer: Buffer.from(zipSync(files)),
        });
        await expect(page.getByTestId("linkedin-preview-section-positions")).toContainText("2 entries");
        await page.getByTestId("linkedin-import-confirm").click();

        await expect(page).toHaveURL(/\/editor\/[^/]+$/, { timeout: 30_000 });
        await expect(page.locator(".resume-page").first().getByText("Senior Software Engineer").first()).toBeVisible();
        expect(external).toEqual([]);
    });

    test("passes axe", async ({ page }) => {
        await page.goto("/tools/linkedin-to-cv");
        await expect(page.getByTestId("linkedin-file-input")).toBeAttached();
        await expectNoA11yViolations(page, { label: "linkedin-tool" });
    });
});

test.describe("GitHub tool page", () => {
    test("turns a GitHub profile into a developer CV in the editor", async ({ page }) => {
        await mockGithubHappyPath(page);
        await page.goto("/tools/github-to-cv");

        await page.getByTestId("github-import-input").fill("octocat");
        await page.getByTestId("github-import-submit").click();
        await expect(page.getByText("engine-cv")).toBeVisible();
        await page.getByTestId("github-import-confirm").click();

        await expect(page).toHaveURL(/\/editor\/[^/]+$/, { timeout: 30_000 });
        await expect(page.locator(".resume-page").first().getByText("engine-cv", { exact: true })).toBeVisible();
    });

    test("says it needs the network when offline and keeps the page readable", async ({ page, context }) => {
        await page.goto("/tools/github-to-cv");
        await expect(page.getByTestId("github-import-input")).toBeVisible();

        await context.setOffline(true);
        await expect(page.getByTestId("tool-offline-notice")).toBeVisible();
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await context.setOffline(false);
        await expect(page.getByTestId("tool-offline-notice")).toBeHidden();
    });

    test("passes axe", async ({ page }) => {
        await page.goto("/tools/github-to-cv");
        await expect(page.getByTestId("github-import-input")).toBeVisible();
        await expectNoA11yViolations(page, { label: "github-tool" });
    });
});

test.describe("CEFR tool page", () => {
    async function rate(page: Page, skill: string, level: string) {
        await page.getByTestId(`cefr-skill-${skill}`).getByRole("radio", { name: new RegExp(`^${level}`) }).check();
    }

    test("rates German skill by skill and adds it to a new CV without leaving the browser", async ({ page }) => {
        const external = await recordExternalRequests(page);
        await page.goto("/tools/cefr-level");

        await page.getByTestId("cefr-language").fill("German");
        await rate(page, "listening", "B2");
        await rate(page, "reading", "B2");
        await rate(page, "spokenInteraction", "B1");
        await rate(page, "spokenProduction", "B1");
        await page.getByTestId("cefr-show-result").click();

        await expect(page.getByTestId("cefr-overall")).toContainText("B1");
        await expect(page.getByTestId("cefr-skipped")).toContainText("Writing");
        await expectNoA11yViolations(page, { label: "cefr-result" });

        await page.getByTestId("cefr-add-to-cv").click();
        await expect(page).toHaveURL(/\/editor\/[^/]+$/, { timeout: 30_000 });
        const preview = page.locator(".resume-page").first();
        await expect(preview.getByText("German").first()).toBeVisible();
        await expect(preview.getByText("B2").first()).toBeVisible();
        expect(external).toEqual([]);
    });

    test("fits a 360px screen in German", async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 800 });
        await page.goto("/de/tools/cefr-level");
        await expect(page.getByTestId("cefr-language")).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
        await expectNoA11yViolations(page, { label: "cefr-tool-de-360" });
    });
});

test.describe("tool routes", () => {
    for (const path of ["/tools/does-not-exist", "/xx/tools/europass-to-cv"]) {
        test(`${path} is a 404`, async ({ request }) => {
            expect((await request.get(path)).status()).toBe(404);
        });
    }
});
