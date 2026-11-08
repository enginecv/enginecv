import { expect, test } from "@playwright/test";

test.describe("locale routes", () => {
    test("server-renders /de in German with lang, canonical and hreflang", async ({ request }) => {
        const html = await (await request.get("/de")).text();

        expect(html).toContain('<html lang="de"');
        expect(html).toContain("<title>Lebenslauf kostenlos erstellen, ohne Konto | EngineCV</title>");
        expect(html).toMatch(/<link rel="canonical" href="[^"]*\/de"/);
        for (const lang of ["en", "de", "bs", "fr", "es", "x-default"]) {
            expect(html).toContain(`hrefLang="${lang}"`);
        }
        expect(html).toContain("Jetzt starten");
    });

    test("keeps / in English whatever language was stored", async ({ request }) => {
        const html = await (await request.get("/", { headers: { cookie: "enginecv-locale=de" } })).text();

        expect(html).toContain('<html lang="en"');
        expect(html).toContain("Start Building");
    });

    test("an unknown locale prefix is a 404", async ({ request }) => {
        expect((await request.get("/xx")).status()).toBe(404);
    });

    test("switching language on the landing page changes the URL, and back returns", async ({ page }) => {
        await page.goto("/");
        await expect(page.locator("html")).toHaveAttribute("lang", "en");

        await page.getByRole("button", { name: "Change language" }).first().click();
        await page.getByRole("link", { name: "Deutsch" }).click();

        await expect(page).toHaveURL(/\/de$/);
        await expect(page.locator("html")).toHaveAttribute("lang", "de");
        await expect(page.getByRole("link", { name: "Jetzt starten" }).first()).toBeVisible();

        await page.goBack();
        await expect(page).toHaveURL(/\/$/);
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
    });

    test("opening /de makes German the app language", async ({ page }) => {
        await page.goto("/de");
        await expect(page.locator("html")).toHaveAttribute("lang", "de");
        // Stored once the page has hydrated.
        await expect.poll(() => page.evaluate(() => document.cookie)).toContain("enginecv-locale=de");

        await page.goto("/dashboard");
        await expect(page.locator("html")).toHaveAttribute("lang", "de");
        await expect(page.getByTestId("dashboard-new-resume")).toHaveAttribute("aria-label", "Neuer Lebenslauf");
    });
});

test.describe("locale suggestion", () => {
    test.use({ locale: "de-DE" });

    test("offers the German page on / without redirecting, and stays dismissed", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveURL(/\/$/);

        const suggestion = page.getByTestId("locale-suggestion");
        await expect(suggestion).toBeVisible();
        await expect(page.getByTestId("locale-suggestion-link")).toHaveAttribute("href", "/de");

        await suggestion.getByRole("button", { name: "Schließen" }).click();
        await expect(suggestion).toBeHidden();

        await page.reload();
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        await expect(page.getByTestId("locale-suggestion")).toBeHidden();
    });
});
