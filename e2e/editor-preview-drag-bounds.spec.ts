import { expect, test, type Page } from "@playwright/test";

async function createBlankResume(page: Page) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-scratch").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    await expect(page.locator(".resume-page").first()).toBeVisible();
}

async function getPreviewBox(page: Page) {
    return page.locator(".resume-page").first().boundingBox();
}

async function getViewportBox(page: Page) {
    return page.locator(".print-exact-scroll-wrapper").first().evaluate((el) => {
        const container = el.closest('.overflow-auto') as HTMLElement | null;
        if (!container) return null;
        const r = container.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
}

function rectsIntersect(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

async function dragPreview(page: Page, dx: number, dy: number) {
    const wrapper = page.locator(".print-exact-scroll-wrapper").first();
    const box = await wrapper.boundingBox();
    if (!box) throw new Error("preview wrapper not measurable");
    const startX = box.x + Math.min(box.width / 2, 200);
    const startY = box.y + Math.min(box.height / 2, 200);

    await page.mouse.move(startX, startY);
    await page.mouse.down({ button: "middle" });
    const steps = 20;
    for (let i = 1; i <= steps; i += 1) {
        await page.mouse.move(startX + (dx * i) / steps, startY + (dy * i) / steps);
    }
    await page.mouse.up({ button: "middle" });
}

async function expectPreviewIntersectsViewport(page: Page) {
    const previewBox = await getPreviewBox(page);
    const viewportBox = await getViewportBox(page);
    expect(previewBox).not.toBeNull();
    expect(viewportBox).not.toBeNull();
    expect(rectsIntersect(previewBox!, viewportBox!)).toBe(true);
}

test.describe("editor preview drag bounds", () => {
    test("drag in any direction keeps the preview document inside the viewport", async ({ page }) => {
        test.skip(page.viewportSize() != null && page.viewportSize()!.width < 1024, "drag panning is desktop-only (lg breakpoint)");

        await createBlankResume(page);

        const drags: Array<[number, number]> = [
            [4000, 0],
            [-4000, 0],
            [0, 4000],
            [0, -4000],
            [4000, 4000],
            [-4000, -4000],
            [4000, -4000],
            [-4000, 4000],
        ];

        for (const [dx, dy] of drags) {
            await dragPreview(page, dx, dy);
            await expectPreviewIntersectsViewport(page);
        }
    });

    test("reset returns the preview to its centered default after bounded drags", async ({ page }) => {
        test.skip(page.viewportSize() != null && page.viewportSize()!.width < 1024, "drag panning is desktop-only (lg breakpoint)");

        await createBlankResume(page);

        // At default zoom the preview is fitted to the viewport and pan bounds collapse
        // to (0,0). Zoom in first so the content overflows and pan motion is meaningful.
        await page.locator(".resume-page").first().hover();
        const zoomInButton = page.getByRole("button", { name: "Zoom in" });
        await expect(zoomInButton).toBeVisible();
        await zoomInButton.click();
        await zoomInButton.click();
        await zoomInButton.click();

        await dragPreview(page, -3000, -3000);
        await expectPreviewIntersectsViewport(page);

        const wrapper = page.locator(".print-exact-scroll-wrapper").first();
        await expect.poll(async () => {
            return await wrapper.evaluate((el) => (el as HTMLElement).style.transform);
        }).not.toBe("translate(0px, 0px)");

        const resetButton = page.getByRole("button", { name: "Reset zoom & position" });
        await expect(resetButton).toBeVisible();
        await resetButton.click();

        await expect.poll(async () => {
            return await wrapper.evaluate((el) => (el as HTMLElement).style.transform);
        }).toBe("translate(0px, 0px)");

        await expectPreviewIntersectsViewport(page);
    });
});
