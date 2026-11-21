import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y";

// Getting-started checklist in the editor sidebar.

async function newBlankCv(page: Page) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-scratch").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    await page.addStyleTag({ content: "nextjs-portal { display: none; }" });
}

test("a new user sees the checklist, it ticks, it can be skipped and brought back", async ({ page }) => {
    await newBlankCv(page);
    const card = page.getByTestId("editor-checklist");
    await expect(card).toBeVisible();
    await expect(page.getByTestId("editor-checklist-progress")).toHaveText("0 of 4 done");
    await expectNoA11yViolations(page, { include: ['[data-testid="editor-checklist"]'], label: "checklist" });

    // The step leads to the field, and typing ticks it.
    await page.getByTestId("editor-checklist-name").getByRole("button").click();
    await page.getByTestId("basics-name-input").fill("Amina Hodzic");
    await page.getByTestId("basics-form-back").click();
    await expect(page.getByTestId("editor-checklist-name")).toHaveAttribute("data-done", "true");

    // Opening Customize ticks that step.
    await page.getByTestId("sidebar-tab-customize").click();
    await page.getByTestId("sidebar-tab-content").click();
    await expect(page.getByTestId("editor-checklist-customize")).toHaveAttribute("data-done", "true");
    await expect(page.getByTestId("editor-checklist-progress")).toHaveText("2 of 4 done");

    // Skip it: it stays gone after a reload.
    await page.getByTestId("editor-checklist-hide").click();
    await expect(card).toBeHidden();
    await page.reload();
    await page.addStyleTag({ content: "nextjs-portal { display: none; }" });
    await expect(page.getByTestId("sidebar-basics-card")).toBeVisible();
    await expect(page.getByTestId("editor-checklist")).toHaveCount(0);

    // Bring it back from the command palette.
    await page.keyboard.press("ControlOrMeta+k");
    await page.getByRole("dialog").getByRole("combobox").or(page.getByPlaceholder(/search|type a command/i)).first().fill("getting started");
    await page.getByRole("option", { name: /Getting started checklist/ }).first().click();
    await expect(page.getByTestId("editor-checklist")).toBeVisible();
    await expect(page.getByTestId("editor-checklist-customize")).toHaveAttribute("data-done", "false");
});
