import { expect, type Page } from "@playwright/test";

/** The Import data window. */
export function hubDialog(page: Page) {
    return page.getByTestId("import-hub-dialog");
}

/** Review what the added sources hold, apply them as a new CV and open it. */
export async function createCvFromHub(page: Page) {
    await page.getByTestId("import-hub-review").click();
    await page.getByTestId("import-hub-apply").click();
    await page.getByTestId("import-hub-open-created").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/, { timeout: 15_000 });
}

/** Adds files to the open window and waits until each is listed as a source. */
export async function addHubFiles(page: Page, files: Parameters<ReturnType<Page["getByTestId"]>["setInputFiles"]>[0], count = 1) {
    await page.getByTestId("import-hub-file-input").setInputFiles(files);
    await expect(page.getByTestId("import-hub-batch")).toHaveCount(count);
}
