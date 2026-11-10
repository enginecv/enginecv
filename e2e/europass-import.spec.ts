import { expect, test, type Page } from "@playwright/test";
import { candidateXml, europassPdf } from "../src/lib/import/europass/__fixtures__/europass-fixtures";
import { addHubFiles, createCvFromHub, hubDialog } from "./helpers/import-hub";

async function openEuropassImport(page: Page) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-europass").click();
    await expect(hubDialog(page)).toBeVisible();
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
    await expect(page.getByTestId("europass-trademark-disclaimer")).toBeVisible();
    await addHubFiles(page, {
        name: "Europass CV.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(europassPdf(candidateXml())),
    });
    await expect(page.getByTestId("import-hub-batch")).toContainText("Europass CV");

    await page.getByTestId("import-hub-review").click();
    await expect(page.getByTestId("import-hub-section-experience").getByTestId("import-hub-row")).toHaveCount(2);
    await page.getByTestId("import-hub-apply").click();
    await page.getByTestId("import-hub-open-created").click();

    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    const preview = page.locator(".resume-page").first();
    await expect(preview.getByText("Amina Kovačević").first()).toBeVisible();
    await expect(preview.getByText("Engineering Lead").first()).toBeVisible();

    expect(external.filter((request) => /europa\.eu/.test(request.href))).toEqual([]);
    expect(external.filter((request) => request.method !== "GET")).toEqual([]);
});

test("explains a PDF that lost its Europass data and the window stays usable", async ({ page }) => {
    await openEuropassImport(page);
    await page.getByTestId("import-hub-file-input").setInputFiles({
        name: "printed.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(europassPdf(null)),
    });

    await expect(page.getByTestId("import-hub-error")).toContainText("No Europass CV data");
    await expect(page.getByTestId("import-hub-batch")).toHaveCount(0);

    // A good file can still be added after the failed one.
    await addHubFiles(page, {
        name: "Europass CV.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(europassPdf(candidateXml())),
    });
    await createCvFromHub(page);
});
