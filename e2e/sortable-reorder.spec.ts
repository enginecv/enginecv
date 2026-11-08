import { expect, test, type Locator, type Page } from "@playwright/test";

async function createBlankResume(page: Page, name?: string) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-scratch").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    if (name) {
        await page.getByTestId("sidebar-basics-card").click();
        await page.getByTestId("basics-name-input").fill(name);
        await page.getByTestId("basics-form-back").click();
    }
}

/** Real pointer drag in small steps, the way a person moves the mouse. */
async function dragHandle(page: Page, handle: Locator, target: Locator, position: "above" | "below") {
    const from = (await handle.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 8, { steps: 4 });
    // dnd-kit measures drop targets once the drag starts.
    await page.waitForTimeout(150);
    const y = position === "above" ? to.y + 2 : to.y + to.height - 2;
    await page.mouse.move(to.x + to.width / 2, y, { steps: 12 });
    await page.waitForTimeout(150);
    await page.mouse.up();
}

test("reorders section entries by dragging the handle", async ({ page }) => {
    await createBlankResume(page);
    await page.getByTestId("add-content-experience").click();
    await page.getByTestId("entry-input-position").fill("First Role");
    await page.getByTestId("section-form-back").click();
    const card = page.getByTestId("section-card-experience");
    if (!await page.getByRole("button", { name: "Add Entry" }).isVisible()) await card.click();
    await page.getByRole("button", { name: "Add Entry" }).click();
    await page.getByTestId("entry-input-position").fill("Second Role");
    await page.getByTestId("section-form-back").click();

    const rows = page.locator('[data-testid^="entry-row-experience-"]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("First Role");

    await dragHandle(page, page.getByTestId("entry-drag-experience-1"), rows.nth(0), "above");

    await expect(rows.nth(0)).toContainText("Second Role");
    await expect(rows.nth(1)).toContainText("First Role");
    const preview = page.locator(".resume-page").first();
    await expect(preview.getByText("Second Role")).toBeVisible();
    const order = await preview.evaluate((element) => element.textContent!.indexOf("Second Role") < element.textContent!.indexOf("First Role"));
    expect(order).toBe(true);
});

test("reorders resume sections from the keyboard", async ({ page }) => {
    await createBlankResume(page);
    await page.getByTestId("add-content-experience").click();
    await page.getByTestId("section-form-back").click();
    await page.getByTestId("add-content-education").click();
    await page.getByTestId("section-form-back").click();

    await page.getByTestId("sidebar-tab-customize").click();
    await page.getByTestId("customize-row-layout").click();
    const rows = page.locator('[data-testid^="section-order-row-"]');
    const before = await rows.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-testid")));
    expect(before.length).toBeGreaterThanOrEqual(2);

    const firstKey = before[0]!.replace("section-order-row-", "");
    await page.getByTestId(`section-order-handle-${firstKey}`).focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(150);
    await page.keyboard.press("Space");

    await expect(rows.nth(1)).toHaveAttribute("data-testid", before[0]!);
    await expect(rows.nth(0)).toHaveAttribute("data-testid", before[1]!);
});

test("moves a skill into another group", async ({ page }) => {
    // Skill forms are tall; keep both groups on screen for a real pointer drag.
    await page.setViewportSize({ width: 1280, height: 1600 });
    await createBlankResume(page);
    await page.getByTestId("add-content-skills").click();
    await page.getByTestId("skills-add-group").click();
    const groups = page.getByTestId("skill-group-card");
    await expect(groups).toHaveCount(2);
    await groups.nth(1).getByTestId("skill-group-name").fill("Tools");

    await groups.nth(0).getByRole("button", { name: "Add Skill" }).click();
    await groups.nth(0).locator('[data-testid="entry-input-name"]').last().fill("Docker");

    const target = groups.nth(1).getByTestId("skill-group-name");
    await expect(target).toBeInViewport();
    await dragHandle(page, groups.nth(0).getByTestId("entry-drag-handle").last(), target, "below");

    await expect(groups.nth(1).locator('[data-testid="entry-input-name"]')).toHaveValue("Docker");
    await expect(groups.nth(0).locator('[data-testid="entry-input-name"]')).toHaveCount(0);
});

test("sorts CVs on the dashboard by name and remembers the choice", async ({ page }) => {
    await createBlankResume(page, "Zeta Person");
    await createBlankResume(page, "Alpha Person");
    await page.goto("/dashboard");

    const cards = page.getByTestId("dashboard-resume-card");
    await expect(cards.first()).toContainText("Alpha Person");

    await page.getByTestId("dashboard-resume-sort").click();
    await page.getByTestId("dashboard-resume-sort-name-desc").click();
    await expect(cards.first()).toContainText("Zeta Person");

    await page.reload();
    await expect(page.getByTestId("dashboard-resume-card").first()).toContainText("Zeta Person");
});
