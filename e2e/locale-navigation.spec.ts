import { expect, test } from "@playwright/test";
import { bs } from "../src/lib/i18n/bs";
import { de } from "../src/lib/i18n/de";
import { es } from "../src/lib/i18n/es";
import { fr } from "../src/lib/i18n/fr";
import { localeLabels } from "../src/lib/i18n";
import { translateBlog } from "../src/lib/blog-i18n";

for (const [locale, dictionary] of Object.entries({ bs, de, fr, es })) {
    test(`${locale}: English discovery opens /blog without changing the saved language`, async ({ page }) => {
        await page.goto(`/${locale}/blog`);
        await expect.poll(() => page.evaluate(() => document.cookie)).toContain(`enginecv-locale=${locale}`);
        const link = page.getByRole("link", { name: translateBlog(locale as keyof typeof localeLabels, "index.moreEnglish"), exact: true });
        await expect(link).toHaveAttribute("href", "/blog");
        await expect(link).toHaveAttribute("hreflang", "en");
        await link.click();
        await expect(page).toHaveURL(/\/blog$/);
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        await expect(page.getByTestId("blog-more-english")).toHaveCount(0);
        await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("enginecv-preferences") ?? "{}").preferences?.appearance?.locale)).toBe(locale);
        await expect.poll(() => page.evaluate(() => document.cookie)).toContain(`enginecv-locale=${locale}`);

        // A shared page still follows the saved interface language.
        await page.getByRole("navigation").first().getByRole("link", { name: "Contact", exact: true }).click();
        await expect(page.getByRole("heading", { name: dictionary["contact.title"], exact: true })).toBeVisible();
    });

    test(`${locale}: navigation keeps language through blog, tools, templates, contact and dashboard`, async ({ page }) => {
        await page.goto("/");
        await page.getByRole("button", { name: "Change language" }).first().click();
        await page.getByRole("link", { name: localeLabels[locale as keyof typeof localeLabels], exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/${locale}$`));

        const nav = page.getByRole("navigation").first();
        await nav.getByRole("link", { name: dictionary["nav.blog"], exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/blog$`));
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(nav.getByRole("link", { name: "EngineCV", exact: true })).toHaveAttribute("href", `/${locale}`);
        await expect(nav.getByRole("link", { name: dictionary["nav.features"], exact: true })).toHaveAttribute("href", `/${locale}#features`);

        await page.goBack();
        await expect(page).toHaveURL(new RegExp(`/${locale}$`));
        await page.goForward();
        await expect(page).toHaveURL(new RegExp(`/${locale}/blog$`));
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await nav.getByRole("link", { name: "EngineCV", exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/${locale}$`));

        await page.locator("footer").getByRole("link", { name: dictionary["footer.tools"], exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/tools$`));
        await page.locator(`main a[href="/${locale}/tools/cefr-level"]`).first().click();
        await expect(page.locator("html")).toHaveAttribute("lang", locale);

        await nav.getByRole("link", { name: dictionary["nav.templates"], exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/cv-templates$`));
        await nav.getByRole("link", { name: dictionary["nav.contact"], exact: true }).click();
        await expect(page).toHaveURL(/\/contact$/);
        await expect(page.getByRole("heading", { name: dictionary["contact.title"], exact: true })).toBeVisible();
        await nav.getByRole("link", { name: "EngineCV", exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/${locale}$`));

        await nav.getByRole("link", { name: dictionary["nav.startBuilding"], exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await page.getByRole("link", { name: "EngineCV", exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/${locale}$`));
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
    });
}

test("direct localized deep links keep language when opening a shared page", async ({ page }) => {
    await page.goto("/bs/tools");
    await expect.poll(() => page.evaluate(() => document.cookie)).toContain("enginecv-locale=bs");
    await page.getByRole("navigation").first().getByRole("link", { name: bs["nav.contact"], exact: true }).click();
    await expect(page.getByRole("heading", { name: bs["contact.title"], exact: true })).toBeVisible();
    await page.getByRole("navigation").first().getByRole("link", { name: "EngineCV", exact: true }).click();
    await expect(page).toHaveURL(/\/bs$/);
});

test("switching language on an empty blog index keeps the blog route and stores the choice", async ({ page }) => {
    await page.goto("/bs/blog");
    await page.getByRole("button", { name: bs["language.change"], exact: true }).first().click();
    await page.getByRole("link", { name: "Français", exact: true }).click();
    await expect(page).toHaveURL(/\/fr\/blog$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");

    await page.getByRole("button", { name: fr["language.change"], exact: true }).first().click();
    await page.getByRole("link", { name: "English", exact: true }).click();
    await expect(page).toHaveURL(/\/blog$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.getByRole("navigation").first().getByRole("link", { name: "Contact", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Contact EngineCV", exact: true })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("mobile Bosnian blog and footer section links preserve the locale", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto("/bs");
    const nav = page.getByRole("navigation").first();
    await nav.getByRole("button", { name: bs["nav.toggleMenu"], exact: true }).click();
    await nav.getByRole("link", { name: bs["nav.blog"], exact: true }).click();
    await expect(page).toHaveURL(/\/bs\/blog$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "bs");
    await page.screenshot({ path: "test-results/locale-blog-bs-mobile.png", fullPage: true });
    await page.locator("footer").getByRole("link", { name: bs["footer.faq"], exact: true }).click();
    await expect(page).toHaveURL(/\/bs#faq$/);
    await expect(page.locator("#faq")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "bs");
});
