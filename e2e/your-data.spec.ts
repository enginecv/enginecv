import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

async function createBlankResume(page: Page) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-scratch").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
}

/** Rows in EngineCV's resumes table, without creating the database when it is gone. */
function countResumes(page: Page) {
    return page.evaluate(async () => {
        const names = (await indexedDB.databases()).map((info) => info.name);
        if (!names.includes("EngineCVDatabase")) return 0;
        return new Promise<number>((resolve, reject) => {
            const open = indexedDB.open("EngineCVDatabase");
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
                const database = open.result;
                if (!database.objectStoreNames.contains("resumes")) {
                    database.close();
                    resolve(0);
                    return;
                }
                const request = database.transaction("resumes").objectStore("resumes").count();
                request.onsuccess = () => {
                    database.close();
                    resolve(request.result);
                };
            };
        });
    });
}

test("lists stored data, downloads it, and deletes everything while another tab is open", async ({ page, context }) => {
    test.setTimeout(120_000);
    await createBlankResume(page);
    const editorUrl = page.url();
    await page.evaluate(() => localStorage.setItem("foo", "bar"));

    await page.goto("/your-data");
    const table = page.getByTestId("your-data-inventory");
    await expect(table).toContainText("resumes");
    // Untouched defaults are never stored, so no preferences row yet.
    await expect(table).not.toContainText("enginecv-preferences");
    await expect(page.getByTestId("your-data-row").filter({ hasText: "foo" })).toContainText("Unrecognised");
    await expect(page.getByTestId("your-data-summary")).toContainText("1 CV");

    // Download my data.
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("your-data-download").getByRole("button", { name: "Download my data" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^enginecv-my-data-\d{4}-\d{2}-\d{2}\.json$/);
    const file = JSON.parse(await readFile((await download.path())!, "utf8"));
    expect(file.format).toBe("enginecv/data-export");
    expect(file.data.indexedDB.EngineCVDatabase.resumes).toHaveLength(1);
    expect(file.data.localStorage.foo).toBe("bar");

    // A second tab with the editor open.
    const other = await context.newPage();
    await other.goto(editorUrl);
    await expect(other.getByRole("main").first()).toBeVisible();

    // Delete everything.
    await page.getByRole("button", { name: "Delete all my data" }).click();
    const dialog = page.getByTestId("delete-all-data-dialog");
    await expect(dialog).toContainText("1 CV");
    const confirm = dialog.getByRole("button", { name: "Delete everything" });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
    // The other tab gets the signal and reloads when the wipe is done. Its notice
    // can be gone before a slow dev server even compiles it, so the reload is the
    // reliable sign (the notice itself is covered by the integration test).
    const otherReloaded = other.waitForEvent("load", { timeout: 30_000 });
    await confirm.click();

    const result = dialog.getByTestId("deletion-result");
    await expect(result).toHaveAttribute("data-status", "complete");
    await expect(result).toContainText("Everything is deleted.");
    expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });

    // The other tab reloads and writes nothing back.
    await otherReloaded;
    expect(await countResumes(other)).toBe(0);

    await dialog.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await countResumes(page)).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem("foo"))).toBeNull();
});

test("the download imports back on the dashboard", async ({ page }) => {
    test.setTimeout(90_000);
    await createBlankResume(page);
    await page.goto("/your-data");
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("your-data-download").getByRole("button", { name: "Download my data" }).click();
    const path = (await (await downloadPromise).path())!;

    await page.goto("/dashboard");
    const before = await countResumes(page);
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-import-json-input").setInputFiles(path);
    await expect(page.getByText(/Imported 1 CV from your data export/)).toBeVisible();
    expect(await countResumes(page)).toBe(before + 1);
});

test("Your data is reachable from the footer, the policies, the dashboard and the palette", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/privacy");
    await expect(page.getByRole("link", { name: "Your data" }).first()).toHaveAttribute("href", "/your-data");
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Your data" })).toBeVisible();

    await page.goto("/cookies");
    await expect(page.getByTestId("cookie-policy-storage")).toContainText("enginecv-readme-credit");
    await page.getByRole("main").getByRole("link", { name: "Your data" }).click();
    await expect(page).toHaveURL(/\/your-data$/);

    await page.goto("/dashboard");
    await page.getByTestId("dashboard-sidebar-delete-all-data").click();
    await expect(page).toHaveURL(/\/your-data\?action=delete$/);
    await expect(page.getByTestId("delete-all-data-dialog")).toBeVisible();
    await page.getByTestId("delete-all-data-dialog").getByRole("button", { name: "Cancel" }).last().click();
    await expect(page.getByTestId("delete-all-data-dialog")).toBeHidden();

    await createBlankResume(page);
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await palette.getByRole("combobox").fill("data");
    await expect(palette.getByRole("option", { name: /Open Your data/ })).toBeVisible();
    await expect(palette.getByRole("option", { name: /Download my data/ })).toBeVisible();
    await expect(palette.getByRole("option", { name: /Delete all my data/ })).toBeVisible();
});
