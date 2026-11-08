import { expect, test, type Page } from "@playwright/test";
import { zipSync } from "fflate";
import { canonicalCsvEntries } from "../src/lib/import/linkedin/__fixtures__/canonical";
import { candidateXml } from "../src/lib/import/europass/__fixtures__/europass-fixtures";
import { de } from "../src/lib/i18n/de";
import { expectNoA11yViolations } from "./helpers/a11y";
import { mockGithubHappyPath } from "./helpers/github-mocks";

// First-run onboarding. Every test starts on a
// fresh browser context, so the dashboard is empty unless a test adds a resume.

function linkedinZip(): Buffer {
    const encoder = new TextEncoder();
    const files: Record<string, Uint8Array> = {};
    for (const [name, text] of Object.entries(canonicalCsvEntries())) {
        files[`Basic_LinkedInDataExport_01-01-2026/${name}`] = encoder.encode(text);
    }
    return Buffer.from(zipSync(files));
}

const JSON_RESUME = {
    meta: { title: "JSON start", description: "", tags: [] },
    basics: { name: "Jasmin Jsonović", headline: "Imported from a file" },
};

async function openEmptyDashboard(page: Page) {
    await page.goto("/dashboard");
    await expect(page.getByTestId("start-panel")).toBeVisible();
}

async function expectEditorWith(page: Page, text: string) {
    await expect(page).toHaveURL(/\/editor\/[^/]+$/, { timeout: 15_000 });
    await expect(page.locator(".resume-page").first().getByText(text).first()).toBeVisible();
}

async function createBlankResume(page: Page) {
    await openEmptyDashboard(page);
    await page.getByTestId("start-option-blank").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
}

test.describe("start panel", () => {
    test("replaces the empty state with every start path", async ({ page }) => {
        await openEmptyDashboard(page);
        const panel = page.getByTestId("start-panel");

        await expect(panel.getByRole("heading", { name: "How do you want to start?" })).toBeVisible();
        for (const id of ["blank", "example", "ai", "linkedin", "europass", "github", "json"]) {
            await expect(page.getByTestId(`start-option-${id}`)).toBeVisible();
        }
        await expectNoA11yViolations(page, { include: ["[data-testid=start-panel]"], label: "start panel" });
    });

    test("blank ends in the editor", async ({ page }) => {
        await createBlankResume(page);
        await expect(page.getByTestId("sidebar-tab-content")).toHaveAttribute("data-state", "active");
    });

    test("LinkedIn archive ends in the editor with the imported profile", async ({ page }) => {
        await openEmptyDashboard(page);
        await page.getByTestId("start-option-linkedin").click();
        await expect(page.getByTestId("linkedin-import-dialog")).toBeVisible();
        await page.getByTestId("linkedin-file-input").setInputFiles({
            name: "Basic_LinkedInDataExport.zip",
            mimeType: "application/zip",
            buffer: linkedinZip(),
        });
        await page.getByTestId("linkedin-import-confirm").click();
        await expectEditorWith(page, "Amina Kovačević");
    });

    test("Europass XML ends in the editor with the imported profile", async ({ page }) => {
        await openEmptyDashboard(page);
        await page.getByTestId("start-option-europass").click();
        await expect(page.getByTestId("europass-import-dialog")).toBeVisible();
        await page.getByTestId("europass-file-input").setInputFiles({
            name: "Europass CV.xml",
            mimeType: "application/xml",
            buffer: Buffer.from(candidateXml()),
        });
        await page.getByTestId("europass-import-confirm").click();
        await expectEditorWith(page, "Amina Kovačević");
    });

    test("GitHub profile ends in the editor with the imported profile", async ({ page }) => {
        await mockGithubHappyPath(page);
        await openEmptyDashboard(page);
        await page.getByTestId("start-option-github").click();
        await expect(page.getByTestId("github-import-dialog")).toBeVisible();
        await page.getByTestId("github-import-input").fill("octocat");
        await page.getByTestId("github-import-submit").click();
        await page.getByTestId("github-import-confirm").click();
        await expectEditorWith(page, "The Octocat");
    });

    test("JSON file ends in the editor with its content", async ({ page }) => {
        await openEmptyDashboard(page);
        await page.getByTestId("start-panel-json-input").setInputFiles({
            name: "resume.json",
            mimeType: "application/json",
            buffer: Buffer.from(JSON.stringify(JSON_RESUME)),
        });
        // A file whose settings get clamped stops on the dashboard with a warning first
        // (existing import behaviour); the resume is saved either way.
        try {
            await expect(page).toHaveURL(/\/editor\/[^/]+$/, { timeout: 3_000 });
        } catch {
            await expect(page.getByText("Some values were adjusted")).toBeVisible();
            await page.getByTestId("dashboard-resume-card").filter({ hasText: "JSON start" }).first().click();
        }
        await expectEditorWith(page, "Jasmin Jsonović");
    });

    test("cancelling an import returns to the panel with focus on the chosen option", async ({ page }) => {
        await openEmptyDashboard(page);
        await page.getByTestId("start-option-linkedin").click();
        await expect(page.getByTestId("linkedin-import-dialog")).toBeVisible();
        await page.keyboard.press("Escape");

        await expect(page.getByTestId("linkedin-import-dialog")).toBeHidden();
        await expect(page.getByTestId("start-option-linkedin")).toBeFocused();
    });

    test("is keyboard operable", async ({ page }) => {
        await openEmptyDashboard(page);
        await page.getByTestId("start-option-blank").focus();
        await page.keyboard.press("Tab");
        await expect(page.getByTestId("start-option-example")).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    });

    test("gives way to the resume grid once a resume exists", async ({ page }) => {
        await createBlankResume(page);
        await page.goto("/dashboard");
        await expect(page.getByTestId("dashboard-resume-card")).toHaveCount(1);
        await expect(page.getByTestId("start-panel")).toHaveCount(0);
    });

    test("fits a 360 px screen without horizontal scrolling", async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 780 });
        await openEmptyDashboard(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
    });
});

test.describe("start links", () => {
    const DIALOGS = {
        linkedin: "linkedin-import-dialog",
        europass: "europass-import-dialog",
        github: "github-import-dialog",
    } as const;

    for (const [start, dialog] of Object.entries(DIALOGS)) {
        test(`?start=${start} opens that import once, on an empty and a filled dashboard`, async ({ page }) => {
            await page.goto(`/dashboard?start=${start}`);
            await expect(page.getByTestId(dialog)).toBeVisible();
            await expect(page).not.toHaveURL(/start=/);

            await page.keyboard.press("Escape");
            await expect(page.getByTestId(dialog)).toBeHidden();
            await page.reload();
            await expect(page.getByTestId("start-panel")).toBeVisible();
            await expect(page.getByTestId(dialog)).toHaveCount(0);

            await page.getByTestId("start-option-blank").click();
            await expect(page).toHaveURL(/\/editor\/[^/]+$/);
            await page.goto(`/dashboard?start=${start}`);
            await expect(page.getByTestId(dialog)).toBeVisible();
        });
    }

    test("?start=json focuses the JSON option (a file picker needs a click)", async ({ page }) => {
        await page.goto("/dashboard?start=json");
        await expect(page.getByTestId("start-option-json")).toBeFocused();

        await page.getByTestId("start-option-blank").click();
        await expect(page).toHaveURL(/\/editor\/[^/]+$/);
        await page.goto("/dashboard?start=json");
        await expect(page.getByTestId("create-resume-import-json")).toBeFocused();
    });

    test("?start=blank creates exactly one resume, even after reload and Back", async ({ page }) => {
        await page.goto("/dashboard");
        await expect(page.getByTestId("start-panel")).toBeVisible();
        await page.goto("/dashboard?start=blank");
        await expect(page).toHaveURL(/\/editor\/[^/]+$/);
        await page.reload();
        await expect(page).toHaveURL(/\/editor\/[^/]+$/);
        await page.goBack();
        // Back lands on the plain dashboard, not on the start link again.
        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.getByTestId("dashboard-resume-card")).toHaveCount(1);
    });

    test("an unknown value shows the plain dashboard", async ({ page }) => {
        await page.goto("/dashboard?start=nope");
        await expect(page.getByTestId("start-panel")).toBeVisible();
        await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test("wins over ?tab=templates and keeps other parameters", async ({ page }) => {
        await page.goto("/dashboard?tab=templates&start=github");
        await expect(page.getByTestId("github-import-dialog")).toBeVisible();
        await expect(page).toHaveURL(/\/dashboard\?tab=templates$/);
        await page.keyboard.press("Escape");
        await expect(page.getByTestId("start-panel")).toBeVisible();
    });
});

test.describe("language into the app", () => {
    test("the blog CTA on a German page opens a German dashboard", async ({ page }) => {
        await page.goto("/de/blog/sprachniveau-im-lebenslauf-angeben");
        await page.locator('main a[href="/dashboard"]').first().click();

        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.getByTestId("start-panel").getByRole("heading", { level: 2 })).toHaveText(de["onboarding.panel.title"]);
        await expect(page.locator("html")).toHaveAttribute("lang", "de");
    });

    test("using a template from the German gallery opens a German editor", async ({ page }) => {
        await page.goto("/de/cv-templates/modern");
        await page.getByTestId("gallery-use-template").click();

        await expect(page).toHaveURL(/\/editor\/[^/]+$/, { timeout: 15_000 });
        await expect(page.locator("html")).toHaveAttribute("lang", "de");
    });
});

test.describe("examples", () => {
    const ROLES = {
        "software-developer": "Emir Hadžić",
        nurse: "Amra Begović",
        "sales-office": "Marija Kovač",
        graduate: "Tarik Mehić",
    } as const;

    for (const [role, name] of Object.entries(ROLES)) {
        test(`the ${role} example ends in the editor, titled as an example`, async ({ page }) => {
            await openEmptyDashboard(page);
            await page.getByTestId("start-option-example").click();
            await expect(page.getByTestId("example-picker-dialog")).toBeVisible();
            await page.getByTestId(`example-role-${role}`).click();
            await expectEditorWith(page, name);

            await page.goto("/dashboard");
            await expect(page.getByTestId("dashboard-resume-card").first()).toContainText("Example –");
        });
    }

    test("Escape closes the picker and returns focus to the example option", async ({ page }) => {
        await openEmptyDashboard(page);
        await page.getByTestId("start-option-example").click();
        await expect(page.getByTestId("example-picker-dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByTestId("example-picker-dialog")).toHaveCount(0);
        await expect(page.getByTestId("start-option-example")).toBeFocused();
    });

    test("?start=example opens the picker; German UI, English content", async ({ page }) => {
        await page.goto("/de");
        // "/de" stores German as the app language once hydrated.
        await page.waitForFunction(() => Object.values(localStorage).some((value) => value.includes('"locale":"de"')));
        await page.goto("/dashboard?start=example");
        const dialog = page.getByTestId("example-picker-dialog");
        await expect(dialog.getByRole("heading")).toHaveText(de["onboarding.example.dialogTitle"]);
        await page.getByTestId("example-role-nurse").click();
        await expectEditorWith(page, "Registered Nurse — Intensive Care");
    });

    test("the create dialog offers examples too", async ({ page }) => {
        await createBlankResume(page);
        await page.goto("/dashboard");
        await page.getByTestId("dashboard-new-resume").click();
        await page.getByTestId("create-resume-from-example").click();
        await expect(page.getByTestId("example-picker-dialog")).toBeVisible();
    });
});

test.describe("print tip", () => {
    test("explains the print dialog before the first PDF export, then stays one click away", async ({ page, context }) => {
        await createBlankResume(page);
        await page.getByTestId("export-menu-button").first().click();
        await page.getByTestId("export-format-pdf").click();
        const tip = page.getByTestId("print-tip");
        await expect(tip).toContainText("Save as PDF");
        await expectNoA11yViolations(page, { include: ["[data-testid=print-tip]"], label: "print tip" });

        await page.getByTestId("export-format-docx").click();
        await expect(tip).toHaveCount(0);
        await page.getByTestId("export-format-pdf").click();

        // Headless Chromium returns from print() at once.
        const popupPromise = context.waitForEvent("page");
        await page.getByTestId("export-confirm-button").click();
        const popup = await popupPromise;
        await expect(page.getByTestId("export-support-card")).toBeVisible({ timeout: 15_000 });
        await popup.close();

        await page.getByTestId("export-menu-button").first().click();
        await page.getByTestId("export-format-pdf").click();
        await expect(page.getByTestId("print-tip")).toHaveCount(0);
        await page.getByTestId("print-tip-toggle").click();
        await expect(page.getByTestId("print-tip")).toContainText("Microsoft Print to PDF");
    });
});
