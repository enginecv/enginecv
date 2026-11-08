import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations, setTheme } from "./helpers/a11y";
import { AD_HOSTS, hostsHit, recordRequests } from "./helpers/network";


// Contract cases P2–P5 (specs/022-trust-baseline/contracts/privacy-network.md).
// Runs only in the `chromium-ads` project, whose server is built with ads enabled
// and a placeholder publisher id. Ad traffic is intercepted and never leaves the machine.

async function blockAdTraffic(page: Page) {
    await page.route(
        (url) => AD_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)),
        (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
    );
}

// Test double for a certified CMP. No live ad or consent traffic leaves the machine.
async function installCmp(page: Page) {
    await page.addInitScript(() => {
        Object.assign(window, {
            __tcfapi(command: string, _version: number, callback: (data: object, success: boolean) => void) {
                if (command !== "addEventListener") return;
                callback({
                    cmpId: 300, cmpStatus: "loaded", eventStatus: "tcloaded", gdprApplies: true,
                    listenerId: 1, tcString: "test-only-cmp-signal",
                    purpose: { consents: { 1: true, 2: true } }, vendor: { consents: { 755: true } },
                }, true);
            },
        });
    });
}

function storedConsent(page: Page) {
    return page.evaluate(() => {
        const raw = localStorage.getItem("enginecv-consent");
        return raw ? (JSON.parse(raw) as { version: number; ads: string }) : null;
    });
}

test.beforeEach(async ({ page }) => {
    await blockAdTraffic(page);
});

test("P2: the ad consent prompt appears and nothing reaches ad hosts before a choice", async ({ page }) => {
    const urls = recordRequests(page);
    await page.goto("/blog/common-resume-mistakes");

    await expect(page.getByTestId("ad-consent-prompt")).toBeVisible();
    expect(hostsHit(urls, AD_HOSTS)).toEqual([]);
});

test("P3: declining keeps ads off across navigation and reloads", async ({ page }) => {
    const urls = recordRequests(page);
    await page.goto("/blog/common-resume-mistakes");
    await page.getByTestId("ad-consent-decline").click();
    await expect(page.getByTestId("ad-consent-prompt")).toBeHidden();

    await page.goto("/dashboard");
    await page.reload();
    await expect(page.getByTestId("dashboard-new-resume")).toBeVisible();

    await expect(page.getByTestId("ad-consent-prompt")).toBeHidden();
    expect(hostsHit(urls, AD_HOSTS)).toEqual([]);
    expect(await storedConsent(page)).toMatchObject({ version: 2, ads: "denied" });
});

test("P4: accepting plus CMP permission loads the ad script", async ({ page }) => {
    await installCmp(page);
    const urls = recordRequests(page);
    await page.goto("/blog/common-resume-mistakes");
    await page.getByTestId("ad-consent-accept").click();

    await expect.poll(() => hostsHit(urls, ["pagead2.googlesyndication.com"]).length).toBeGreaterThan(0);
    expect(await storedConsent(page)).toMatchObject({ version: 2, ads: "granted" });
});

test("CV example pages follow the same consent rules as the blog, and the editor stays ad-free", async ({ page }) => {
    await installCmp(page);
    const urls = recordRequests(page);
    await page.goto("/cv-examples/nurse");

    await expect(page.getByTestId("ad-consent-prompt")).toBeVisible();
    expect(hostsHit(urls, AD_HOSTS)).toEqual([]);

    await page.getByTestId("ad-consent-accept").click();
    await expect.poll(() => hostsHit(urls, ["pagead2.googlesyndication.com"]).length).toBeGreaterThan(0);

    // "Edit this example" lands in the editor, which never carries ads or the script.
    await page.getByTestId("edit-example").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/, { timeout: 20_000 });
    await expect(page.locator("ins.adsbygoogle")).toHaveCount(0);
    await expect(page.locator("#enginecv-adsense-src")).toHaveCount(0);
});

test("P5: withdrawing consent on the cookies page stops ad requests", async ({ page }) => {
    await installCmp(page);
    await page.goto("/blog/common-resume-mistakes");
    await page.getByTestId("ad-consent-accept").click();

    await page.goto("/cookies");
    await expect(page.getByTestId("ad-consent-status")).toHaveAttribute("data-status", "granted");
    await page.getByTestId("ad-consent-withdraw").click();
    await expect(page.getByTestId("ad-consent-status")).toHaveAttribute("data-status", "denied");

    const urls = recordRequests(page);
    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-new-resume")).toBeVisible();

    expect(hostsHit(urls, AD_HOSTS)).toEqual([]);
    expect(await storedConsent(page)).toMatchObject({ version: 2, ads: "denied" });
});

test("local opt-in alone cannot load ads without a CMP signal", async ({ page }) => {
    const urls = recordRequests(page);
    await page.goto("/blog/common-resume-mistakes");
    await page.getByTestId("ad-consent-accept").click();
    await expect(page.getByTestId("ad-consent-prompt")).toBeHidden();
    await page.reload();
    expect(hostsHit(urls, ["pagead2.googlesyndication.com", "googleads.g.doubleclick.net"])).toEqual([]);
    await expect(page.locator("#enginecv-adsense-src")).toHaveCount(0);
});

test("ads stay off on core routes and Bosnian content even after both permissions", async ({ page }) => {
    await installCmp(page);
    await page.addInitScript(() => localStorage.setItem("enginecv-consent", JSON.stringify({
        version: 2, ads: "granted", decidedAt: "2026-10-18T00:00:00.000Z",
    })));
    const urls = recordRequests(page);
    for (const path of ["/", "/de", "/editor/missing", "/bs/blog/nivo-jezika-u-cv-u"]) {
        await page.goto(path);
        await expect(page.getByTestId("ad-consent-prompt")).toBeHidden();
        await expect(page.locator("#enginecv-adsense-src")).toHaveCount(0);
    }
    expect(hostsHit(urls, AD_HOSTS)).toEqual([]);
});

for (const theme of ["dark", "light"] as const) {
    test(`the ad consent prompt has no accessibility violations (${theme})`, async ({ page }) => {
        await setTheme(page, theme);
        await page.goto("/blog/common-resume-mistakes");

        await expect(page.getByTestId("ad-consent-prompt")).toBeVisible();
        await expectNoA11yViolations(page, { label: `${theme}-ad-consent-prompt` });
    });
}

// T065: the prompt is a fixed panel with two buttons and a link, so long
// translations at the narrowest supported width are where it would break.
for (const locale of ["de"] as const) {
    test(`the ad consent prompt fits a 360px screen in ${locale}`, async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 740 });
        await page.addInitScript((stored: string) => {
            window.localStorage.setItem("enginecv-locale", stored);
        }, locale);
        await page.goto("/de/blog/sprachniveau-im-lebenslauf-angeben");

        const prompt = page.getByTestId("ad-consent-prompt");
        await expect(prompt).toBeVisible();

        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
        for (const testId of ["ad-consent-prompt", "ad-consent-accept", "ad-consent-decline"]) {
            const box = await page.getByTestId(testId).boundingBox();
            expect(box, testId).not.toBeNull();
            expect(box!.x, `${testId} left edge`).toBeGreaterThanOrEqual(0);
            expect(box!.x + box!.width, `${testId} right edge`).toBeLessThanOrEqual(360);
        }
    });
}
