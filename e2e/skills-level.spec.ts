import { expect, test, type Page } from "@playwright/test";
import { openJsonFixture, savedResume } from "./helpers/json-editor";

// Skill level meter setting (feature 085). The QA fixture resume has levelled skills.

function skillsHeading(page: Page) {
    return page.locator('.resume-page [data-nav-kind="heading"][data-nav-section="skills"] h2').first();
}

const meters = (page: Page) => page.locator('.resume-page [data-testid^="resume-skill-level-"]');

async function openSkillsCustomize(page: Page) {
    await skillsHeading(page).scrollIntoViewIfNeeded();
    await skillsHeading(page).click();
    await page.getByRole("button", { name: "Customize section", exact: true }).click();
    const row = page.getByTestId("customize-row-skillsSection");
    if (await row.isVisible().catch(() => false)) await row.click();
    await expect(page.getByTestId("skills-section-controls")).toBeVisible();
}

async function savedSkillsSection(page: Page) {
    const resume = await savedResume(page);
    return {
        ...resume.settings.skillsSection,
        ...(resume.customization?.sectionOverrides?.skills?.skillsSection ?? {}),
    };
}

test.describe("skills level meter", () => {
    test("shows dots by default, restyles, hides, and keeps the choice after a reload", async ({ page }) => {
        await openJsonFixture(page, false);
        await expect(skillsHeading(page)).toBeVisible();
        const dotsBefore = await meters(page).count();
        expect(dotsBefore).toBeGreaterThan(0);

        await openSkillsCustomize(page);

        await page.getByTestId("skills-level-style-number").click();
        await expect(page.locator('.resume-page [data-testid="resume-skill-level-number"]').first()).toContainText(/^\d\/5$/);
        await page.getByTestId("skills-level-style-text").click();
        await expect(page.locator('.resume-page [data-testid="resume-skill-level-text"]').first()).not.toBeEmpty();
        await page.getByTestId("skills-level-style-bar").click();
        await expect(page.locator('.resume-page [data-testid="resume-skill-level-bar"]').first()).toBeVisible();

        await page.getByRole("checkbox", { name: "Show skill levels" }).uncheck();
        await expect(meters(page)).toHaveCount(0);
        await expect(page.getByTestId("skills-level-style-bar")).toHaveCount(0);

        await expect.poll(async () => (await savedSkillsSection(page)).showLevels).toBe(false);
        await page.reload();
        await expect(skillsHeading(page)).toBeVisible();
        await expect(meters(page)).toHaveCount(0);

        await openSkillsCustomize(page);
        await page.getByRole("checkbox", { name: "Show skill levels" }).check();
        await expect(meters(page)).toHaveCount(dotsBefore);
        expect((await savedSkillsSection(page)).levelStyle).toBe("bar");
    });
});
