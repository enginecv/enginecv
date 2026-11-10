import { expect, test, type Page } from "@playwright/test";
import { zipSync } from "fflate";
import { canonicalCsvEntries } from "../src/lib/import/linkedin/__fixtures__/canonical";
import { addHubFiles, createCvFromHub, hubDialog } from "./helpers/import-hub";

function zipBuffer(entries: Record<string, string>): Buffer {
    const encoder = new TextEncoder();
    const files: Record<string, Uint8Array> = {};
    for (const [name, text] of Object.entries(entries)) {
        files[`Basic_LinkedInDataExport_01-01-2026/${name}`] = encoder.encode(text);
    }
    return Buffer.from(zipSync(files));
}

/**
 * Abort every request that leaves localhost and record it. The import must
 * complete with all external traffic blocked — proving the archive never
 * leaves the device (SC-004). The app shell itself references static assets
 * (Google Fonts, feature-gated ads script), so the assertion checks that no
 * request targets LinkedIn and none is a data-carrying (non-GET) request.
 */
async function blockExternalRequests(page: Page): Promise<Array<{ method: string; href: string }>> {
    const external: Array<{ method: string; href: string }> = [];
    await page.route("**/*", async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
            await route.continue();
            return;
        }
        external.push({ method: request.method(), href: url.href });
        await route.abort();
    });
    return external;
}

async function openLinkedinImport(page: Page) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-linkedin").click();
    await expect(hubDialog(page)).toBeVisible();
}

test("imports a LinkedIn archive into a new resume entirely offline from LinkedIn", async ({ page }) => {
    const externalRequests = await blockExternalRequests(page);
    await openLinkedinImport(page);

    await page.getByTestId("import-hub-linkedin-guide").locator("summary").click();
    await expect(page.getByTestId("linkedin-import-guide")).toBeVisible();
    await expect(page.getByTestId("linkedin-export-link")).toHaveAttribute(
        "href",
        "https://www.linkedin.com/mypreferences/d/download-my-data",
    );
    await expect(page.getByTestId("linkedin-trademark-disclaimer")).toBeVisible();

    const parseStart = Date.now();
    await addHubFiles(page, {
        name: "Basic_LinkedInDataExport.zip",
        mimeType: "application/zip",
        buffer: zipBuffer(canonicalCsvEntries()),
    });
    // SC-006: the archive is read in under 10 seconds for a profile-only export.
    expect(Date.now() - parseStart).toBeLessThan(10_000);

    await page.getByTestId("import-hub-review").click();
    await expect(page.getByTestId("import-hub-section-experience").getByTestId("import-hub-row")).toHaveCount(2);
    await page.getByTestId("import-hub-apply").click();
    await page.getByTestId("import-hub-open-created").click();

    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    await expect(page.getByText("Amina Kovačević").first()).toBeVisible();

    // SC-004: every external request was blocked and the import still
    // completed; nothing targeted LinkedIn and nothing carried data out.
    expect(externalRequests.filter((request) => request.href.includes("linkedin"))).toEqual([]);
    expect(externalRequests.filter((request) => request.method !== "GET")).toEqual([]);

    await page.goto("/dashboard");
    await expect(
        page.getByTestId("dashboard-resume-card").filter({ hasText: "LinkedIn import" }),
    ).toBeVisible();
});

test("shows the no-profile-data message for a connections-only export and recovers", async ({ page }) => {
    await openLinkedinImport(page);

    await page.getByTestId("import-hub-file-input").setInputFiles({
        name: "Connections.zip",
        mimeType: "application/zip",
        buffer: zipBuffer({
            "Connections.csv": "First Name,Last Name,Company\r\nAda,Lovelace,Analytical Engines\r\n",
        }),
    });

    const error = page.getByTestId("import-hub-error");
    await expect(error).toBeVisible();
    await expect(error).toContainText("doesn't contain profile data");

    // The window stays open and a good archive can follow.
    await addHubFiles(page, {
        name: "Basic_LinkedInDataExport.zip",
        mimeType: "application/zip",
        buffer: zipBuffer(canonicalCsvEntries()),
    });

    // Dashboard stays fully usable after dismissing the window.
    await page.getByTestId("import-hub-close").click();
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(hubDialog(page)).not.toBeVisible();
    await expect(page.getByTestId("dashboard-new-resume")).toBeVisible();
});
