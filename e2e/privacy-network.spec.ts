import { expect, test } from "@playwright/test";
import { AD_HOSTS, ANALYTICS_HOSTS, CLOUDFLARE_ANALYTICS_HOSTS, FONT_HOSTS, hostsHit, recordRequests } from "./helpers/network";
import { ENGINECV_KOFI_URL } from "../src/lib/support";
import { showLandingDemo } from "./helpers/landing";
import { openJsonFixture, replaceJsonDocument, savedResume } from "./helpers/json-editor";

test("JSON tools make no external requests and apply offline", async ({ page, context }) => {
    const external: string[] = [];
    await page.route("**/*", route => {
        const url = new URL(route.request().url());
        if (["localhost", "127.0.0.1"].includes(url.hostname)) return route.continue();
        external.push(url.href); return route.abort();
    });
    const value = await openJsonFixture(page);
    await page.getByRole("button", { name: "Clean up" }).click();
    await page.getByRole("button", { name: "Dismiss" }).click();
    await page.getByRole("button", { name: "Vim", exact: true }).click();
    await expect(page.getByText("NORMAL", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Standard", exact: true }).click();
    await context.setOffline(true);
    value.meta.title += " offline"; value.basics.photo = "enginecv:photo";
    await replaceJsonDocument(page, JSON.stringify(value, null, 2));
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect.poll(async () => (await savedResume(page)).meta.title).toBe(value.meta.title);
    await context.setOffline(false);
    expect(external).toEqual([]);
});

// Executable form of specs/022-trust-baseline/contracts/privacy-network.md (P1, P6, P8).
// These cases must hold whether or not the server was built with ads enabled:
// without consent, nothing reaches ad hosts, and no analytics beyond the
// cookieless page measurement Cloudflare adds in production runs at all.

const FIRST_PARTY_COOKIES = new Set(["enginecv-locale"]);

// A genuine first visit: no stored consent decision (overrides the project default).
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page }) => {
    // Never let real ad traffic leave the machine, even if a regression loads it.
    await page.route(
        (url) => AD_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)),
        (route) => route.fulfill({ status: 204, body: "" }),
    );
});

test("P1: no analytics, ad or font-host requests and no extra cookies across the core journey", async ({ page, context }) => {
    test.setTimeout(90_000);
    const urls = recordRequests(page);

    await page.goto("/");
    await showLandingDemo(page);
    await page.goto("/blog");
    await expect(page.locator('a[href^="/blog/"]').first()).toBeVisible();
    await page.goto("/cv-examples/nurse");
    await expect(page.getByTestId("edit-example")).toBeVisible();
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-scratch").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    await page.getByTestId("add-content-experience").click();
    await page.getByTestId("entry-input-position").fill("Privacy Contract Role");
    await page.getByTestId("section-form-back").click();

    await page.getByTestId("export-menu-button").first().click();
    await page.getByTestId("export-format-json").click();
    const download = page.waitForEvent("download");
    await page.getByTestId("export-confirm-button").click();
    await download;

    // PNG export embeds the preview fonts, which used to be fetched from Google Fonts.
    await page.getByTestId("export-menu-button").first().click();
    await page.getByTestId("export-format-png").click();
    const pngDownload = page.waitForEvent("download");
    await page.getByTestId("export-confirm-button").click();
    await pngDownload;

    expect(hostsHit(urls, ANALYTICS_HOSTS), "analytics requests").toEqual([]);
    // Cloudflare Web Analytics is added by the edge on enginecv.app, never by the
    // app: a request from a local build would mean analytics crept into the bundle.
    expect(hostsHit(urls, CLOUDFLARE_ANALYTICS_HOSTS), "analytics loaded by the app itself").toEqual([]);
    expect(hostsHit(urls, AD_HOSTS), "ad requests before consent").toEqual([]);
    expect(hostsHit(urls, FONT_HOSTS), "third-party font requests for built-in fonts").toEqual([]);

    const cookies = await context.cookies();
    const unexpected = cookies
        .filter((cookie) => !(FIRST_PARTY_COOKIES.has(cookie.name) && cookie.domain.includes("localhost")))
        .map((cookie) => `${cookie.name}@${cookie.domain}`);
    expect(unexpected, "cookies outside the first-party allowlist").toEqual([]);
});

const LEGACY_COOKIES = ["_ga", "_ga_TEST123", "_gid", "enginecv_ref", "enginecv_ref_pending"];

test("P6: legacy tracking cookies and v1 consent are purged on the next visit", async ({ page, context, baseURL }) => {
    const url = new URL(baseURL!);
    await context.addCookies(
        LEGACY_COOKIES.map((name) => ({
            name,
            value: "legacy",
            domain: url.hostname,
            path: "/",
        })),
    );
    await page.addInitScript(() => {
        if (!sessionStorage.getItem("seeded-v1-consent")) {
            localStorage.setItem("enginecv-consent", JSON.stringify({
                analyticsStorage: "granted",
                adStorage: "granted",
                adUserData: "granted",
                adPersonalization: "granted",
            }));
            sessionStorage.setItem("seeded-v1-consent", "1");
        }
    });

    await page.goto("/");
    await showLandingDemo(page);

    await expect.poll(async () => (await context.cookies())
        .map((cookie) => cookie.name)
        .filter((name) => LEGACY_COOKIES.includes(name)))
        .toEqual([]);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("enginecv-consent"))).toBeNull();
});

test("P8: referral links redirect without setting cookies", async ({ request }) => {
    const response = await request.get("/r/contract-test", { maxRedirects: 0 });

    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    expect(new URL(response.headers()["location"] ?? "", "http://x").pathname).toBe("/");
    expect(response.headers()["set-cookie"]).toBeUndefined();
});

test("P8: Ko-fi placement links redirect to Ko-fi without setting cookies", async ({ request }) => {
    const response = await request.get("/go/kofi/contract-test", { maxRedirects: 0 });

    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    expect(response.headers()["location"]).toBe(ENGINECV_KOFI_URL);
    expect(response.headers()["set-cookie"]).toBeUndefined();
});

// specs/073-agent-authoring-format/contracts/ui-and-routes.md (privacy contract, FR-020).
test("P9: pasted and copied CV text never leaves the browser", async ({ page, context }) => {
    test.setTimeout(90_000);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const MARKER = "PrivacyMarker7Q3Z";
    const leaks: string[] = [];
    page.on("request", (request) => {
        const body = request.postData() ?? "";
        if (request.url().includes(MARKER) || body.includes(MARKER)) leaks.push(`${request.method()} ${request.url()}`);
    });

    await page.goto("/dashboard?start=ai");
    await page.getByTestId("paste-from-ai-copy-instructions").click();
    await page.getByTestId("paste-from-ai-input").fill(JSON.stringify({
        format: "enginecv.authoring/v1",
        basics: { name: `Lejla ${MARKER}`, email: "lejla@example.com" },
        experience: [{ position: `Nurse ${MARKER}`, company: "KCUS", start: "2019-03" }],
    }));
    await expect(page.getByTestId("paste-from-ai-summary")).toBeVisible();
    await page.getByTestId("paste-from-ai-import").click();
    await page.waitForURL(/\/editor\/[^/]+$/);

    await page.getByTestId("export-menu-button").first().click();
    await page.getByTestId("export-copy-for-ai-button").click();
    await expect(page.getByTestId("export-copy-for-ai-button")).toHaveText(/Copied/);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(MARKER);

    // Let any late request (analytics, prefetch, autosave sync) fire before checking.
    await page.waitForTimeout(1_000);
    expect(leaks, "requests carrying pasted CV text").toEqual([]);
});

test("P10: Your data reads, downloads and deletes without sending data anywhere", async ({ page, baseURL }) => {
    test.setTimeout(90_000);
    const origin = new URL(baseURL!).origin;
    const requests: Array<{ url: string; method: string }> = [];
    page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));

    await page.goto("/your-data");
    await expect(page.getByTestId("your-data-download")).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByTestId("your-data-download").getByRole("button").click();
    await download;

    const beforeDelete = requests.length;
    await page.getByTestId("your-data-delete").getByRole("button").click();
    const dialog = page.getByTestId("delete-all-data-dialog");
    await dialog.getByRole("textbox").fill("DELETE");
    await dialog.getByRole("button", { name: "Delete everything" }).click();
    await expect(dialog.getByTestId("deletion-result")).toBeVisible();

    expect(requests.filter((request) => !request.url.startsWith(origin)).map((request) => request.url), "requests leaving the site").toEqual([]);
    const posts = requests.slice(beforeDelete).filter((request) => request.method === "POST");
    expect(posts.map((request) => new URL(request.url).pathname)).toEqual(["/api/clear-site-data"]);
});
