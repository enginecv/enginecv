import { expect, test } from "@playwright/test";

test.describe("template gallery", () => {
    test("lists eight templates and filters by photo and columns", async ({ page }) => {
        await page.goto("/cv-templates");
        const cards = page.getByTestId("gallery-card");
        await expect(cards).toHaveCount(8);

        await page.getByTestId("gallery-filter-photo").click();
        await expect(cards).toHaveCount(2);
        await expect(cards.nth(0)).toHaveAttribute("data-slug", "photo-header");
        await expect(cards.nth(1)).toHaveAttribute("data-slug", "lebenslauf");

        await page.getByTestId("gallery-filter-two").click();
        await expect(cards).toHaveCount(1);
        await expect(cards.first()).toHaveAttribute("data-slug", "sidebar");

        await page.getByTestId("gallery-filter-all").click();
        await expect(cards).toHaveCount(8);
    });

    test("server-renders a German template page with its own title, canonical and hreflang", async ({ request }) => {
        const html = await (await request.get("/de/cv-templates/lebenslauf")).text();

        expect(html).toContain('<html lang="de"');
        expect(html).toContain("<title>Lebenslauf-Vorlage Lebenslauf, kostenlos | EngineCV</title>");
        expect(html).toMatch(/<link rel="canonical" href="[^"]*\/de\/cv-templates\/lebenslauf"/);
        expect(html).toContain('hrefLang="x-default"');
        expect(html).toContain("Für wen sie passt");
    });

    test("every template page has a unique title", async ({ request }) => {
        const slugs = ["modern", "ats-plain", "sidebar", "photo-header", "lebenslauf", "timeline", "executive", "developer"];
        const titles = new Set<string>();
        for (const slug of slugs) {
            const response = await request.get(`/cv-templates/${slug}`);
            expect(response.status(), slug).toBe(200);
            titles.add((await response.text()).match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
        }
        expect(titles.size).toBe(slugs.length);
        expect((await request.get("/cv-templates/not-a-template")).status()).toBe(404);
    });

    test("Use template creates a resume and opens it in the editor", async ({ page }) => {
        await page.goto("/cv-templates/developer");
        await page.getByTestId("gallery-use-template").click();
        await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    });
});
