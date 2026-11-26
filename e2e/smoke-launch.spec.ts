import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { zipSync } from "fflate";
import { extractText } from "unpdf";
import { candidateXml, europassPdf } from "../src/lib/import/europass/__fixtures__/europass-fixtures";
import { canonicalCsvEntries } from "../src/lib/import/linkedin/__fixtures__/canonical";
import { mockGithubHappyPath } from "./helpers/github-mocks";
import { addHubFiles, createCvFromHub, hubDialog } from "./helpers/import-hub";
import { clearOpfs, installPicker, listDir, readFile as readWorkspaceFile, writeFile as writeWorkspaceFile } from "./helpers/workspace";

/**
 * Automated version of the pre-launch smoke test from the vault's EngineCV Index
 * ("Where we left off, 2026-11-15"). Runs against the local dev server, not the live site.
 *
 * Not automatable here (do by hand): a private window with the network tab open, real Safari
 * and Firefox on a real machine, Microsoft Print to PDF, a real disk or cloud folder, a real
 * agent, and a phone. See the report that came with this file.
 */

const NAME = "Smoke Tester";

async function newBlankCv(page: Page) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-scratch").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
}

async function buildCvFromScratch(page: Page) {
    await newBlankCv(page);
    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-name-input").fill(NAME);
    await page.getByTestId("basics-form-back").click();
    await page.getByTestId("add-content-experience").click();
    await page.getByTestId("entry-input-position").fill("Smoke Role");
    await page.getByTestId("entry-input-company").fill("Smoke Systems");
    await page.getByTestId("section-form-back").click();
    const preview = page.locator(".resume-page").first();
    await expect(preview.getByText("Smoke Role")).toBeVisible();
    await expect(preview.getByText(NAME).first()).toBeVisible();
}

/** Opens a Customize row, first switching to the "Whole resume" view when the row is hidden. */
async function openCustomizeRow(page: Page, key: string) {
    const row = page.getByTestId(`customize-row-${key}`);
    if (!(await row.isVisible())) await page.getByRole("button", { name: "Whole resume" }).click();
    await row.click();
}

/** The font family the preview uses for the CV owner's name. */
async function nameFont(page: Page): Promise<string> {
    return page.evaluate((name) => {
        const pageEl = document.querySelector(".resume-page");
        if (!pageEl) return "";
        const walker = document.createTreeWalker(pageEl, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if ((node.textContent ?? "").trim().toLowerCase() === name.toLowerCase() && node.parentElement) return getComputedStyle(node.parentElement).fontFamily;
        }
        return "";
    }, NAME);
}

async function exportAs(page: Page, format: string) {
    await page.getByTestId("export-menu-button").first().click();
    await page.getByTestId(`export-format-${format}`).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-confirm-button").click();
    const download = await downloadPromise;
    return { name: download.suggestedFilename(), bytes: await readFile((await download.path())!) };
}

test.describe("build a CV and export it", () => {
    test("from scratch, then Markdown, DOCX and plain text downloads hold the content", async ({ page }) => {
        await buildCvFromScratch(page);

        const md = await exportAs(page, "md");
        expect(md.name).toMatch(/\.md$/);
        expect(md.bytes.toString("utf8")).toContain("Smoke Role");
        expect(md.bytes.toString("utf8")).toContain(NAME);

        const docx = await exportAs(page, "docx");
        expect(docx.name).toMatch(/\.docx$/);
        const xml = await (await JSZip.loadAsync(docx.bytes)).file("word/document.xml")!.async("string");
        expect(xml).toContain("Smoke Role");
        expect(xml).toContain("Smoke Systems");

        const txt = await exportAs(page, "txt");
        expect(txt.bytes.toString("utf8")).toContain("Smoke Role");
    });

    test("PDF export opens the print window with the CV, and its text is selectable", async ({ page, context, browserName }) => {
        test.skip(browserName !== "chromium", "PDF bytes are produced with Chromium's page.pdf(); print dialogs cannot be driven elsewhere");
        await buildCvFromScratch(page);

        // The print window gets the preview's pages.
        await page.getByTestId("export-menu-button").first().click();
        await page.getByTestId("export-format-pdf").click();
        const popupPromise = context.waitForEvent("page");
        await page.getByTestId("export-confirm-button").click();
        const popup = await popupPromise;
        await popup.waitForLoadState();
        await expect(popup.locator(".resume-page").first()).toContainText("Smoke Role");
        await popup.close();

        // Print the app's own HTML export to a real PDF and read the text back: it is text, not an image.
        const html = await exportAs(page, "html");
        await page.setContent(html.bytes.toString("utf8"), { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
        const { text } = await extractText(new Uint8Array(pdf), { mergePages: true });
        expect(text).toContain("Smoke Role");
        expect(text).toContain("Smoke Systems");
        expect(text.toLowerCase()).toContain(NAME.toLowerCase()); // the template sets the name in capitals
    });
});

test.describe("imports", () => {
    test("LinkedIn archive", async ({ page }) => {
        const encoder = new TextEncoder();
        const files: Record<string, Uint8Array> = {};
        for (const [name, text] of Object.entries(canonicalCsvEntries())) files[`Basic_LinkedInDataExport_01-01-2026/${name}`] = encoder.encode(text);

        await page.goto("/dashboard");
        await page.getByTestId("dashboard-new-resume").click();
        await page.getByTestId("create-resume-from-linkedin").click();
        await expect(hubDialog(page)).toBeVisible();
        await addHubFiles(page, { name: "Basic_LinkedInDataExport.zip", mimeType: "application/zip", buffer: Buffer.from(zipSync(files)) });
        await createCvFromHub(page);
        await expect(page.getByText("Amina Kovačević").first()).toBeVisible();
    });

    test("Europass PDF", async ({ page }) => {
        await page.goto("/dashboard");
        await page.getByTestId("dashboard-new-resume").click();
        await page.getByTestId("create-resume-from-europass").click();
        await expect(hubDialog(page)).toBeVisible();
        await addHubFiles(page, { name: "Europass CV.pdf", mimeType: "application/pdf", buffer: Buffer.from(europassPdf(candidateXml())) });
        await createCvFromHub(page);
        await expect(page.locator(".resume-page").first().getByText("Amina Kovačević").first()).toBeVisible();
    });

    test("GitHub profile (mocked API)", async ({ page }) => {
        await mockGithubHappyPath(page);
        await page.goto("/dashboard?start=github");
        await expect(hubDialog(page)).toBeVisible();
        await page.getByTestId("github-import-input").fill("octocat");
        await page.getByTestId("github-import-submit").click();
        await expect(page.getByTestId("github-import-repos-section")).toBeVisible();
        await page.getByTestId("github-import-confirm").click();
        await createCvFromHub(page);
        await expect(page.locator(".resume-page").first().getByText("engine-cv", { exact: true })).toBeVisible();
    });
});

test.describe("settings that must survive a reload", () => {
    test("template and CV language", async ({ page }) => {
        await buildCvFromScratch(page);

        // Template: pick Developer in the template browser.
        await page.getByTestId("sidebar-tab-customize").click();
        await openCustomizeRow(page, "templates");
        await page.getByRole("button", { name: "Browse templates" }).click();
        await page.getByTitle("Apply Developer").click();

        // Language: German CV headings.
        await openCustomizeRow(page, "languageRegion");
        await page.getByTestId("language-select").click();
        await page.getByTestId("language-option-de").click();
        const pageOne = page.getByTestId("resume-preview-page-1");
        await expect(pageOne.locator('[data-preview-section-heading="experience"]')).toBeVisible();
        await page.waitForTimeout(500);
        await expect(page.getByText(/Saved at/)).toBeVisible();

        await page.reload();
        await expect(page).toHaveURL(/\/editor\/[^/]+$/);
        await expect(page.getByTestId("resume-preview-page-1").locator('[data-preview-section-heading="experience"]')).toBeVisible();
        await expect(page.getByTestId("resume-preview-page-1")).toContainText(NAME);

        // The German language is still selected, and the Developer template's look survived: it sets the name in JetBrains Mono.
        await page.getByTestId("sidebar-tab-customize").click();
        await openCustomizeRow(page, "languageRegion");
        await expect(page.getByTestId("language-select")).toContainText(/Deutsch|German/);
        await expect.poll(() => nameFont(page)).toContain("JetBrains Mono");
    });
});

test.describe("your data", () => {
    test("download, then delete everything", async ({ page }) => {
        test.setTimeout(120_000);
        await buildCvFromScratch(page);

        await page.goto("/your-data");
        await expect(page.getByTestId("your-data-summary")).toContainText("1 CV");
        const downloadPromise = page.waitForEvent("download");
        await page.getByTestId("your-data-download").getByRole("button", { name: "Download my data" }).click();
        const download = await downloadPromise;
        const file = JSON.parse(await readFile((await download.path())!, "utf8"));
        expect(file.format).toBe("enginecv/data-export");
        expect(file.data.indexedDB.EngineCVDatabase.resumes).toHaveLength(1);

        await page.getByRole("button", { name: "Delete all my data" }).click();
        const dialog = page.getByTestId("delete-all-data-dialog");
        await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
        await dialog.getByRole("button", { name: "Delete everything" }).click();
        await expect(dialog.getByTestId("deletion-result")).toHaveAttribute("data-status", "complete", { timeout: 30_000 });
        await expect(dialog.getByTestId("deletion-result")).toContainText("Everything is deleted.");
        expect(await page.evaluate(() => localStorage.length)).toBe(0);
    });
});

test.describe("workspace folder basics", () => {
    test("Chromium: connects a folder, writes the files, follows an outside edit and disconnects", async ({ page, browserName }) => {
        test.skip(browserName !== "chromium", "File System Access exists only in Chromium; the other engines are checked below");
        await installPicker(page);
        await page.goto("/dashboard");
        await clearOpfs(page);
        await buildCvFromScratch(page);
        await page.goto("/dashboard");

        await page.getByTestId("dashboard-sidebar-workspace").click();
        await page.getByTestId("workspace-choose").click();
        await page.getByTestId("workspace-warning-continue").click();
        await page.getByTestId("workspace-first-sync-apply").click();
        await expect(page.getByTestId("workspace-phase-connected")).toBeVisible();

        await expect.poll(async () => (await listDir(page, "cvs")).length).toBeGreaterThan(0);
        await expect.poll(async () => (await listDir(page, "cvs")).some((n) => n.endsWith(".cv.json"))).toBe(true);
        const cvPath = `cvs/${(await listDir(page, "cvs")).find((n) => n.endsWith(".cv.json"))}`;
        expect(await readWorkspaceFile(page, "AGENTS.md")).not.toBeNull();
        await expect.poll(async () => ((await readWorkspaceFile(page, cvPath)) ?? "").length, { timeout: 10_000 }).toBeGreaterThan(10);
        const original = JSON.parse((await readWorkspaceFile(page, cvPath))!) as Record<string, unknown>;
        expect((original.basics as Record<string, string>).name).toBe(NAME);

        // An outside program (or an agent) edits the file; the app follows within seconds.
        const edited = { ...original, basics: { ...(original.basics as object), name: "Edited Outside" } };
        await writeWorkspaceFile(page, cvPath, `${JSON.stringify(edited, null, 2)}\n`);
        await page.getByTestId("workspace-close").click();
        await expect
            .poll(
                () =>
                    page.evaluate(async () => {
                        const rows = await new Promise<unknown[]>((resolve) => {
                            const open = indexedDB.open("EngineCVDatabase");
                            open.onsuccess = () => {
                                const all = open.result.transaction("resumes", "readonly").objectStore("resumes").getAll();
                                all.onsuccess = () => resolve(all.result);
                            };
                            open.onerror = () => resolve([]);
                        });
                        return JSON.stringify(rows).includes("Edited Outside");
                    }),
                { timeout: 15_000 },
            )
            .toBe(true);

        // Disconnecting leaves the files in the folder.
        await page.getByTestId("dashboard-sidebar-workspace").click();
        await page.getByTestId("workspace-disconnect").click();
        await page.getByLabel("Disconnect the workspace folder?").getByRole("button", { name: "Disconnect" }).click();
        expect(await readWorkspaceFile(page, cvPath)).not.toBeNull();
    });

    test("other engines: the panel explains that a Chromium browser is needed", async ({ page, browserName }) => {
        test.skip(browserName === "chromium", "Chromium connects folders; see the test above");
        await page.goto("/dashboard");
        await page.getByTestId("dashboard-sidebar-workspace").click();
        await expect(page.getByText(/need Chrome, Edge or another Chromium-based browser/i)).toBeVisible();
    });
});
