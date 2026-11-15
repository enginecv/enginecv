import { expect, test, type Page } from "@playwright/test";
import { openJsonFixture } from "./helpers/json-editor";

// Section placement in the two-column layout (feature 086): the side the
// Customize section list shows must be the column the preview draws.

async function openLayoutPanel(page: Page) {
    await page.getByTestId("sidebar-tab-customize").first().click();
    await page.getByTestId("customize-row-layout").click();
    await expect(page.locator('[data-testid^="section-order-row-"]').first()).toBeVisible();
}

async function chooseTwoColumns(page: Page) {
    await page.getByRole("button", { name: "Two", exact: true }).click();
    await expect(page.locator(".resume-page").first()).toBeVisible();
}

/** Content section keys in the order the list shows them (no separators or page breaks). */
async function sectionKeys(page: Page): Promise<string[]> {
    const ids = await page.locator('[data-testid^="section-order-row-"]').evaluateAll((rows) => rows.map((row) => row.getAttribute("data-testid") ?? ""));
    return ids
        .map((id) => id.replace("section-order-row-", ""))
        .filter((key) => !/^(separator|vertical-separator|pagebreak)/.test(key));
}

/** The side the list shows as selected for a section. */
async function toggleSide(page: Page, key: string): Promise<string | null> {
    return page.getByTestId(`section-order-row-${key}`).evaluate((row) => {
        const selected = Array.from(row.querySelectorAll("button")).find((button) => button.className.includes("border-accent") && /^(Left|Right|Full)$/.test(button.textContent ?? ""));
        return selected ? (selected.textContent ?? "").toLowerCase() : null;
    });
}

/** The column the preview drew a section in; null when the section is not on a page. */
async function previewSide(page: Page, key: string): Promise<"left" | "right" | "full" | null> {
    return page.evaluate((sectionKey) => {
        const items = Array.from(document.querySelectorAll<HTMLElement>("[data-preview-layout-item]"))
            .filter((node) => (node.dataset.previewLayoutItem ?? "").includes(sectionKey));
        if (items.length === 0) return null;
        const first = items[0];
        const right = Math.max(...Array.from(document.querySelectorAll<HTMLElement>("[data-preview-layout-item]")).map((node) => parseFloat(node.style.left || "0") + parseFloat(node.style.width || "0")));
        if (parseFloat(first.style.left || "0") > 0) return "right";
        return parseFloat(first.style.width || "0") >= right - 1 ? "full" : "left";
    }, key);
}

async function expectAllAgree(page: Page) {
    for (const key of await sectionKeys(page)) {
        const onPage = await previewSide(page, key);
        if (onPage === null) continue; // not rendered (hidden or empty): nothing to compare
        expect(await toggleSide(page, key), `toggle for ${key}`).toBe(onPage);
    }
}

async function clickSide(page: Page, key: string, side: "Left" | "Right" | "Full") {
    await page.getByTestId(`section-order-row-${key}`).getByRole("button", { name: side, exact: true }).click();
}

test.describe("section placement in the two-column layout", () => {
    test("the toggle matches the preview, including a stored left on an odd position, after a reload", async ({ page }) => {
        await openJsonFixture(page, false);
        await openLayoutPanel(page);
        await chooseTwoColumns(page);
        await expectAllAgree(page);

        // Put Left on the second and fourth sections: positions whose default is Right.
        const keys = await sectionKeys(page);
        expect(keys.length).toBeGreaterThanOrEqual(4);
        for (const key of [keys[1], keys[3]]) await clickSide(page, key, "Left");
        await expectAllAgree(page);
        expect(await toggleSide(page, keys[1])).toBe("left");

        await page.reload();
        await expect(page.locator(".resume-page").first()).toBeVisible();
        await openLayoutPanel(page);
        await expectAllAgree(page);
        expect(await toggleSide(page, keys[1])).toBe("left");
        expect(await toggleSide(page, keys[3])).toBe("left");
    });

    test("one click per side puts the section there, and clicking the same side again changes nothing", async ({ page }) => {
        await openJsonFixture(page, false);
        await openLayoutPanel(page);
        await chooseTwoColumns(page);
        const key = (await sectionKeys(page))[1];

        for (const [side, expected] of [["Right", "right"], ["Left", "left"], ["Right", "right"]] as const) {
            await clickSide(page, key, side);
            await expect.poll(() => previewSide(page, key)).toBe(expected);
            expect(await toggleSide(page, key)).toBe(expected);
        }

        // Clicking Right again leaves it on the right.
        await clickSide(page, key, "Right");
        await page.waitForTimeout(250);
        expect(await previewSide(page, key)).toBe("right");
        expect(await toggleSide(page, key)).toBe("right");
        await expectAllAgree(page);
    });

    test("switching one, two and mixed columns keeps the chosen sides", async ({ page }) => {
        await openJsonFixture(page, false);
        await openLayoutPanel(page);
        await chooseTwoColumns(page);
        const key = (await sectionKeys(page))[1];
        await clickSide(page, key, "Left");
        await expect.poll(() => previewSide(page, key)).toBe("left");

        await page.getByRole("button", { name: "Mix", exact: true }).click();
        await page.getByRole("button", { name: "Two", exact: true }).click();
        await page.getByRole("button", { name: "One", exact: true }).click();
        await page.getByRole("button", { name: "Two", exact: true }).click();

        await expect.poll(() => previewSide(page, key)).toBe("left");
        await expectAllAgree(page);
    });
});
