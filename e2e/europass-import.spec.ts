import { expect, test, type Page } from "@playwright/test";
import { candidateXml, europassPdf } from "../src/lib/import/europass/__fixtures__/europass-fixtures";

async function openEuropassImport(page: Page) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-europass").click();
    await expect(page.getByTestId("europass-import-dialog")).toBeVisible();
}

test("imports a Europass PDF into a new resume without contacting Europass", async ({ page }) => {
    const external: Array<{ method: string; href: string }> = [];
    await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
            await route.continue();
            return;
        }
        external.push({ method: route.request().method(), href: url.href });
        await route.abort();
    });

    await openEuropassImport(page);
    await page.getByTestId("europass-file-input").setInputFiles({
        name: "Europass CV.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(europassPdf(candidateXml())),
    });

    await expect(page.getByTestId("europass-preview-profile")).toContainText("Amina Kovačević");
    await expect(page.getByTestId("europass-preview-section-experience")).toContainText("2 entries");

    await page.getByTestId("europass-import-confirm").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    const preview = page.locator(".resume-page").first();
    await expect(preview.getByText("Amina Kovačević").first()).toBeVisible();
    await expect(preview.getByText("Engineering Lead").first()).toBeVisible();

    expect(external.filter((request) => /europa\.eu/.test(request.href))).toEqual([]);
    expect(external.filter((request) => request.method !== "GET")).toEqual([]);
});

test("explains a PDF that lost its Europass data and recovers", async ({ page }) => {
    await openEuropassImport(page);
    await page.getByTestId("europass-file-input").setInputFiles({
        name: "printed.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(europassPdf(null)),
    });

    await expect(page.getByTestId("europass-import-error")).toContainText("No Europass CV data");
    await page.getByTestId("europass-import-retry").click();
    await expect(page.getByTestId("europass-import-guide")).toBeVisible();
});
