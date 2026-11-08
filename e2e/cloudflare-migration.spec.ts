import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const routes = [
    "/",
    "/dashboard",
    "/blog",
    "/blog/why-i-built-enginecv",
    "/privacy",
    "/cookies",
    "/terms",
];

async function createBlankResume(page: Page) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-scratch").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    await expect(page.getByTestId("sidebar-tab-content")).toHaveAttribute("data-state", "active");
}

async function importResume(page: Page, buffer: Buffer, expectedName: string) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-import-json-input").setInputFiles({
        name: "enginecv-import-smoke.json",
        mimeType: "application/json",
        buffer,
    });

    try {
        await expect(page).toHaveURL(/\/editor\/[^/]+$/, { timeout: 2_000 });
    } catch {
        await expect(page.getByText("Some values were adjusted")).toBeVisible();
        await page.locator('[data-testid="dashboard-resume-card"]').filter({ hasText: expectedName }).first().click();
        await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    }
}

test("loads critical routes and public assets", async ({ page, request }) => {
    for (const route of routes) {
        const response = await page.goto(route);
        expect(response?.ok(), `${route} should load`).toBe(true);
    }

    const assetResponse = await request.get("/next.svg");
    expect(assetResponse.ok()).toBe(true);
});

test("preserves local-first resume workflow on the same origin", async ({ page }) => {
    const name = "Cloudflare Migration Smoke";
    const importedName = "Imported Cloudflare Migration Smoke";

    await createBlankResume(page);
    const editorUrl = page.url();
    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-name-input").fill(name);
    await expect(page.locator('[data-testid="resume-preview-name"]:visible').first()).toHaveText(name);
    const resumeId = new URL(editorUrl).pathname.split("/").pop()!;
    await expect.poll(() => page.evaluate(async (id) => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("EngineCVDatabase");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return new Promise<string>((resolve, reject) => {
            const request = database.transaction("resumes", "readonly").objectStore("resumes").get(id);
            request.onsuccess = () => resolve(request.result?.basics?.name ?? "");
            request.onerror = () => reject(request.error);
        });
    }, resumeId), { timeout: 15_000 }).toBe(name);

    await page.reload();
    await expect(page).toHaveURL(editorUrl);
    await page.getByTestId("sidebar-basics-card").click();
    await expect(page.getByTestId("basics-name-input")).toHaveValue(name);

    await page.locator('a[href="/dashboard"]').first().click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('[data-testid="dashboard-resume-card"]').filter({ hasText: name }).first()).toBeVisible();

    await page.locator('[data-testid="dashboard-resume-card"]').filter({ hasText: name }).first().click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    await page.getByTestId("export-menu-button").click();
    await page.getByTestId("export-format-json").click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-confirm-button").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.json$/);

    const exportPath = await download.path();
    expect(exportPath).toBeTruthy();
    const exportedResume = JSON.parse(await readFile(exportPath!, "utf8"));
    exportedResume.basics.name = importedName;
    exportedResume.meta.title = importedName;

    await importResume(page, Buffer.from(JSON.stringify(exportedResume)), importedName);
    await expect(page.locator('[data-testid="resume-preview-name"]:visible').first()).toHaveText(importedName);
});

test("validates canonical apex and www redirect behavior when a production base URL is provided", async ({ page }) => {
    test.skip(!process.env.MIGRATION_CANONICAL_BASE_URL, "Set MIGRATION_CANONICAL_BASE_URL to validate production routing.");

    await page.goto(process.env.MIGRATION_CANONICAL_BASE_URL!);
    expect(new URL(page.url()).hostname).toBe("enginecv.app");

    await page.goto("https://www.enginecv.app");
    await expect(page).toHaveURL(/^https:\/\/enginecv\.app/);
});
