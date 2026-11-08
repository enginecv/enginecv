import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { parse } from "yaml";
import { de } from "../src/lib/i18n/de";
import { expectNoA11yViolations } from "./helpers/a11y";

// The CEFR pilot article in three languages. German and Bosnian start as
// drafts; the expectations read the frontmatter so they still hold once a
// reviewer publishes a version.
const EN = "/blog/cefr-language-levels-on-your-cv";
const DE = "/de/blog/sprachniveau-im-lebenslauf-angeben";
const BS = "/bs/blog/nivo-jezika-u-cv-u";

function isDraft(file: string): boolean {
    const source = fs.readFileSync(path.join(process.cwd(), "content", "blog", file), "utf8");
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    return Boolean(match && parse(match[1]).draft);
}

const deDraft = isDraft("de/sprachniveau-im-lebenslauf-angeben.mdx");
const bsDraft = isDraft("bs/nivo-jezika-u-cv-u.mdx");

test("an English post stays English for a visitor who stored German", async ({ page }) => {
    await page.addInitScript(() => {
        window.localStorage.setItem("enginecv-locale", "de");
    });
    await page.goto(EN);

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("How to List Language Levels on Your CV (A1–C2)");
    await expect(page.getByText(/\d+ min read/).first()).toBeVisible();
    await expect(page.getByText(/Lesezeit/)).toHaveCount(0);
    await expect(page.getByRole("link", { name: "CEFR self-assessment" })).toHaveAttribute("href", "/tools/cefr-level");
});

test("the German post is German throughout and links the German CEFR tool", async ({ page }) => {
    await page.goto(DE);

    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sprachniveau im Lebenslauf angeben (A1–C2)");
    await expect(page.getByText(/\d+ Min\. Lesezeit/).first()).toBeVisible();
    await expect(page.getByText("Gründer, EngineCV")).toBeVisible();
    await expect(page.getByRole("link", { name: "GER-Selbsteinschätzung" })).toHaveAttribute("href", "/de/tools/cefr-level");

    const robots = page.locator('meta[name="robots"]');
    if (deDraft) {
        await expect(page.getByTestId("blog-draft-notice")).toContainText("Entwurf in Prüfung");
        await expect(robots).toHaveAttribute("content", /noindex/);
        await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
    } else {
        await expect(page.getByTestId("blog-draft-notice")).toHaveCount(0);
        await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/blog\/cefr-language-levels-on-your-cv$/);
    }
});

test("posts require a matching translation; empty localized indexes keep the reader's language", async ({ page }) => {
    for (const missing of ["/de/blog/common-resume-mistakes", "/fr/blog/nivo-jezika-u-cv-u"]) {
        const response = await page.goto(missing);
        expect(response?.status(), missing).toBe(404);
    }

    const deIndex = await page.goto("/de/blog");
    expect(deIndex?.status()).toBe(200);
    if (deDraft) await expect(page.getByTestId("blog-empty-state")).toBeVisible();

    const frIndex = await page.goto("/fr/blog");
    expect(frIndex?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByTestId("blog-empty-state")).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
});

test("switching language on a post keeps the reader on the same article when it is published", async ({ page }) => {
    await page.goto(DE);
    await page.getByLabel(de["language.change"]).first().click();

    // Drafts stay hidden; an unavailable translation leads to its localized blog index.
    await expect(page.getByRole("link", { name: "Bosanski" })).toHaveAttribute("href", bsDraft ? "/bs/blog" : BS);
    await expect(page.getByRole("link", { name: "English" })).toHaveAttribute("href", EN);
    await expect(page.getByRole("link", { name: "Français" })).toHaveAttribute("href", "/fr/blog");
});

test("the German post fits a 360px screen", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(DE);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
});

test("the German post has no serious accessibility violations", async ({ page }) => {
    await page.goto(DE);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expectNoA11yViolations(page, { label: "blog-de-post" });
});
