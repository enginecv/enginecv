import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const FIXTURE = path.join(process.cwd(), "src", "lib", "__fixtures__", "json-resume", "full.json");

// A CV that loses nothing when it goes back out: no photo address, no company blurb, no custom skill level.
const CLEAN_RESUME = JSON.stringify({
    basics: { name: "Jane Doe", label: "Engineer", email: "jane@example.com", profiles: [{ network: "GitHub", username: "janedoe", url: "https://github.com/janedoe" }] },
    work: [{ name: "Acme", position: "Dev", startDate: "2020-01", endDate: "2021-01", highlights: ["Shipped it"] }],
});

test.describe("JSON Resume", () => {
    test("imports a resume.json on the dashboard and shows what did not carry over", async ({ page }) => {
        await page.goto("/dashboard");
        await page.getByTestId("dashboard-import-resume-input").setInputFiles({
            name: "resume.json",
            mimeType: "application/json",
            buffer: readFileSync(FIXTURE),
        });

        const result = page.getByTestId("json-resume-import-result");
        await expect(result).toBeVisible();
        await expect(result.getByTestId("conversion-loss-summary")).toContainText("The photo is a web address and was not downloaded");

        await result.getByRole("link", { name: "Open CV" }).click();
        await expect(page).toHaveURL(/\/editor\/[^/]+$/);
        await expect(page.getByText("John Doe").first()).toBeVisible();
    });

    test("export marks JSON Resume as lossy, starts with the photo off, and lists nothing for a CV that loses nothing", async ({ page }) => {
        await page.goto("/dashboard");
        await page.getByTestId("dashboard-import-resume-input").setInputFiles({
            name: "resume.json",
            mimeType: "application/json",
            buffer: Buffer.from(CLEAN_RESUME),
        });
        // Nothing was lost on the way in, so the editor opens straight away.
        await expect(page).toHaveURL(/\/editor\/[^/]+$/);

        await page.getByTestId("export-menu-button").click();
        await expect(page.getByTestId("export-format-lossy-jsonresume")).toBeVisible();
        await page.getByTestId("export-format-jsonresume").click();
        await expect(page.getByTestId("export-jsonresume-include-photo")).toHaveAttribute("aria-checked", "false");
        await expect(page.getByTestId("conversion-loss-summary")).toHaveCount(0);
    });

    test("export lists the extra details an imported CV cannot carry back out", async ({ page }) => {
        await page.goto("/dashboard");
        await page.getByTestId("dashboard-import-resume-input").setInputFiles({
            name: "resume.json",
            mimeType: "application/json",
            buffer: readFileSync(FIXTURE),
        });
        await page.getByTestId("json-resume-import-result").getByRole("link", { name: "Open CV" }).click();
        await expect(page).toHaveURL(/\/editor\/[^/]+$/);

        await page.getByTestId("export-menu-button").click();
        await page.getByTestId("export-format-jsonresume").click();
        // The imported CV has a skill level that is plain text, which JSON Resume cannot carry back as a level.
        await expect(page.getByTestId("conversion-loss-summary")).toContainText("Extra details with no place in this format");
    });
});
