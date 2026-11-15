import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { openJsonFixture } from "./helpers/json-editor";

// Self-contained HTML export (feature 084): the saved file must look the same
// opened from disk with no network, and must not depend on the site.

async function openExampleInEditor(page: Page) {
    await page.goto("/cv-examples/software-developer");
    await page.getByTestId("edit-example").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/, { timeout: 20_000 });
    await expect(page.locator(".resume-page").first()).toBeVisible({ timeout: 20_000 });
}

async function exportHtml(page: Page) {
    await page.getByTestId("export-menu-button").first().click();
    await page.getByTestId("export-format-html").click();
    const started = Date.now();
    const download = page.waitForEvent("download");
    await page.getByTestId("export-confirm-button").click();
    const file = await download;
    const target = path.join(os.tmpdir(), `enginecv-html-export-${Date.now()}.html`);
    await file.saveAs(target);
    return { target, elapsedMs: Date.now() - started };
}

function pdfPageCount(pdf: Buffer): number {
    return (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

/** Opens the saved file with no network at all and returns what it requested. */
async function openOffline(browser: Browser, target: string) {
    const context = await browser.newContext({ offline: true, viewport: { width: 1280, height: 900 } });
    const view = await context.newPage();
    const requests: string[] = [];
    view.on("request", (request) => {
        const url = request.url();
        if (!url.startsWith("file:") && !url.startsWith("data:")) requests.push(url);
    });
    await view.goto(`file:///${target.replace(/\\/g, "/")}`);
    await view.evaluate(() => document.fonts.ready);
    return { context, view, requests };
}

async function layoutProblems(view: Page) {
    return view.evaluate(() => {
        const pageWidth = document.querySelector(".print-exact-page-wrapper")?.getBoundingClientRect().width ?? 800;
        const oversized = Array.from(document.querySelectorAll("svg"))
            .map((svg) => svg.getBoundingClientRect())
            .filter((box) => box.width > pageWidth / 4 || box.height > pageWidth / 4).length;
        const boxes = Array.from(document.querySelectorAll<HTMLElement>("[data-preview-section-heading], [data-testid='resume-preview-summary']"))
            .map((element) => element.getBoundingClientRect())
            .filter((box) => box.width > 0 && box.height > 0);
        let overlaps = 0;
        for (let i = 0; i < boxes.length; i += 1) {
            for (let j = i + 1; j < boxes.length; j += 1) {
                const a = boxes[i];
                const b = boxes[j];
                if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlaps += 1;
            }
        }
        return { oversized, overlaps };
    });
}

function expectSelfContainedSource(html: string) {
    expect(html).not.toMatch(/<link\b/i);
    expect(html).not.toMatch(/<base\b/i);
    expect(html).not.toMatch(/<script\b/i);
    expect(html).not.toMatch(/localhost:\d+/);
}

test.describe("self-contained HTML export", () => {
    test("a typical CV exports small and fast, and opens offline looking like the preview", async ({ page, browser }) => {
        await openExampleInEditor(page);
        const previewPages = await page.locator(".resume-page").count();

        const { target, elapsedMs } = await exportHtml(page);
        const html = fs.readFileSync(target, "utf8");

        console.log(`html export (typical CV): ${Math.round(fs.statSync(target).size / 1024)} KB in ${elapsedMs} ms`);
        // Size and time targets for a typical CV (SC-005).
        expect(fs.statSync(target).size).toBeLessThan(2_000_000);
        expect(elapsedMs).toBeLessThan(5_000);
        expectSelfContainedSource(html);

        const { context, view, requests } = await openOffline(browser, target);
        expect(requests, "requests made while opening the file").toEqual([]);
        await expect(view.locator(".print-exact-page-wrapper")).toHaveCount(previewPages);

        const { oversized, overlaps } = await layoutProblems(view);
        expect(oversized, "oversized svg icons").toBe(0);
        expect(overlaps, "overlapping headings or summary").toBe(0);

        // Printing the file gives the same number of pages as the preview.
        const pdf = await view.pdf({ preferCSSPageSize: true, printBackground: true });
        expect(pdfPageCount(pdf)).toBe(previewPages);

        await context.close();
        fs.rmSync(target, { force: true });
    });

    test("a CV that uses many scripts still opens offline with no requests and no layout problems", async ({ page, browser }) => {
        await openJsonFixture(page, false);
        await expect(page.locator(".resume-page").first()).toBeVisible();
        const previewPages = await page.locator(".resume-page").count();

        const { target, elapsedMs } = await exportHtml(page);
        const html = fs.readFileSync(target, "utf8");
        console.log(`html export (all scripts): ${Math.round(fs.statSync(target).size / 1024)} KB in ${elapsedMs} ms`);

        // The QA fixture needs Latin, Cyrillic, Greek and more, so it is allowed to be larger.
        expect(fs.statSync(target).size).toBeLessThan(6_000_000);
        expectSelfContainedSource(html);

        const { context, view, requests } = await openOffline(browser, target);
        expect(requests, "requests made while opening the file").toEqual([]);
        await expect(view.locator(".print-exact-page-wrapper")).toHaveCount(previewPages);
        const { oversized, overlaps } = await layoutProblems(view);
        expect(oversized, "oversized svg icons").toBe(0);
        expect(overlaps, "overlapping headings or summary").toBe(0);

        await context.close();
        fs.rmSync(target, { force: true });
    });

    test("keeps hyperlinks working in the saved file", async ({ page, browser }) => {
        await openJsonFixture(page, false);
        const { target } = await exportHtml(page);

        const { context, view } = await openOffline(browser, target);
        const hrefs = await view.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href")));
        expect(hrefs.some((href) => href?.startsWith("mailto:"))).toBe(true);
        expect(hrefs.some((href) => href?.startsWith("http"))).toBe(true);

        await context.close();
        fs.rmSync(target, { force: true });
    });
});
