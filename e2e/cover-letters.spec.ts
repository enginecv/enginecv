import { expect, test, type Page } from "@playwright/test";

async function createBlankResume(page: Page) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-scratch").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
}

async function storedCvName(page: Page, resumeId: string) {
    return page.evaluate(async (id) => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("EngineCVDatabase");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return new Promise<string>((resolve, reject) => {
            const request = database.transaction("resumes", "readonly").objectStore("resumes").get(id);
            request.onsuccess = () => resolve(request.result?.basics?.name ?? "");
            request.onerror = () => reject(request.error);
        });
    }, resumeId);
}

/** The first printed page; the preview also holds an off-screen copy used for measuring. */
const firstPage = (page: Page) => page.getByTestId("letter-page").first();
/** Width in CSS px; the page is scaled, so allow sub-pixel rounding. */
const pageWidth = async (page: Page) => parseFloat(await firstPage(page).evaluate((el) => getComputedStyle(el).width));

test("a letter follows its CV and keeps the text the person wrote", async ({ page }) => {
    // A CV with a name and a headline.
    await createBlankResume(page);
    const cvUrl = page.url();
    const cvId = new URL(cvUrl).pathname.split("/").pop()!;
    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-name-input").fill("Amina Hodzic");
    await page.getByTestId("basics-headline-input").fill("Product Designer");
    await expect.poll(() => storedCvName(page, cvId), { timeout: 15_000 }).toBe("Amina Hodzic");

    // Start a letter from the CV: it is linked, and the sender block is already filled.
    await page.getByTestId("editor-write-letter").click();
    await expect(page).toHaveURL(/\/letters\/[^/]+$/);
    const letterUrl = page.url();
    await expect(firstPage(page)).toContainText("Amina Hodzic");
    await expect(firstPage(page)).toContainText("Product Designer");

    // Write something, then let it save.
    await page.getByTestId("letter-paragraph-input-0").fill("I would love to join the team.");
    await expect(page.getByTestId("letter-save-state")).toContainText(/Saved/);

    // Change the CV.
    await page.goto(cvUrl);
    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-name-input").fill("Amina H. Hodzic");
    await expect.poll(() => storedCvName(page, cvId), { timeout: 15_000 }).toBe("Amina H. Hodzic");

    // The letter shows the new name, and the words are still there.
    await page.goto(letterUrl);
    await expect(firstPage(page)).toContainText("Amina H. Hodzic");
    await expect(page.getByTestId("letter-paragraph-input-0")).toHaveValue("I would love to join the team.");
});

test("the Cover Letters tab asks for a CV first, then creates a letter", async ({ page }) => {
    await page.goto("/dashboard?tab=letters");
    await expect(page.getByTestId("letters-empty")).toBeVisible();
    await expect(page.getByTestId("letters-create-cv")).toBeVisible();

    await createBlankResume(page);
    await page.goto("/dashboard?tab=letters");
    await expect(page.getByTestId("letters-empty")).toBeVisible();
    await page.getByTestId("letter-new").click();
    await page.getByTestId("letters-cv-create").click(); // the first CV is preselected
    await expect(page).toHaveURL(/\/letters\/[^/]+$/);
    await expect(page.getByTestId("letter-editor")).toBeVisible();
});

test("letters are grouped under their CV, can be duplicated and moved to another CV", async ({ page }) => {
    // Two CVs; the dashboard lists them by title, so name them.
    await createBlankResume(page);
    const firstCv = page.url().split("/").pop()!;
    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-name-input").fill("First Person");
    await expect.poll(() => storedCvName(page, firstCv), { timeout: 15_000 }).toBe("First Person");
    await createBlankResume(page);
    const secondCv = page.url().split("/").pop()!;

    // Two letters for the first CV (the picker appears because there are two CVs).
    await page.goto("/dashboard?tab=letters");
    for (let count = 0; count < 2; count++) {
        await page.getByTestId("letter-new").click();
        await page.getByTestId(`letters-cv-option-${firstCv}`).click();
        await page.getByTestId("letters-cv-create").click();
        await expect(page).toHaveURL(/\/letters\/[^/]+$/, { timeout: 30_000 });
        await page.goto("/dashboard?tab=letters");
    }
    const group = page.getByTestId(`letters-group-${firstCv}`);
    await expect(group.getByTestId("letter-card")).toHaveCount(2);

    // Duplicate one: still the same group, now three.
    await group.getByTestId("letter-action-duplicate").first().click();
    await expect(group.getByTestId("letter-card")).toHaveCount(3);

    // Move one to the second CV.
    await group.getByTestId("letter-action-repoint").first().click();
    await page.getByTestId(`letter-repoint-option-${secondCv}`).click();
    await page.getByTestId("letter-repoint-confirm").click();
    await expect(page.getByTestId(`letters-group-${secondCv}`).getByTestId("letter-card")).toHaveCount(1);
    await expect(group.getByTestId("letter-card")).toHaveCount(2);
});

test("a letter marked as sent keeps the sender it had, and unfreezing makes it follow the CV again", async ({ page }) => {
    await createBlankResume(page);
    const cvUrl = page.url();
    const cvId = new URL(cvUrl).pathname.split("/").pop()!;
    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-name-input").fill("Sent Person");
    await expect.poll(() => storedCvName(page, cvId), { timeout: 15_000 }).toBe("Sent Person");

    await page.getByTestId("editor-write-letter").click();
    await expect(page).toHaveURL(/\/letters\/[^/]+$/, { timeout: 30_000 });
    const letterUrl = page.url();
    await expect(firstPage(page)).toContainText("Sent Person");

    // Mark as sent (the CV has no email, so the dialog warns first).
    await page.getByTestId("letter-mark-sent").click();
    await expect(page.getByTestId("letter-send-warnings")).toBeVisible();
    await page.getByTestId("letter-send-confirm").click();
    await expect(page.getByTestId("letter-status-chip")).toHaveText(/Sent/i);

    // Rename the CV: the sent letter does not change.
    await page.goto(cvUrl);
    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-name-input").fill("Renamed Person");
    await expect.poll(() => storedCvName(page, cvId), { timeout: 15_000 }).toBe("Renamed Person");
    await page.goto(letterUrl);
    await expect(firstPage(page)).toContainText("Sent Person");
    await expect(firstPage(page)).not.toContainText("Renamed Person");

    // Unfreeze: it follows the CV again.
    await page.getByTestId("letter-unfreeze").click();
    await page.getByRole("dialog").getByRole("button", { name: "Unfreeze" }).click();
    await expect(firstPage(page)).toContainText("Renamed Person");
});

test("deleting a CV with letters never deletes a letter: drafts are moved or frozen, sent letters stay", async ({ page }) => {
    // Two CVs with distinct names.
    await createBlankResume(page);
    const doomed = page.url().split("/").pop()!;
    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-name-input").fill("Doomed Person");
    await expect.poll(() => storedCvName(page, doomed), { timeout: 15_000 }).toBe("Doomed Person");
    await createBlankResume(page);
    const survivor = page.url().split("/").pop()!;
    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-name-input").fill("Survivor Person");
    await expect.poll(() => storedCvName(page, survivor), { timeout: 15_000 }).toBe("Survivor Person");

    // Two letters on the doomed CV; one of them is marked as sent.
    await page.goto("/dashboard?tab=letters");
    for (let count = 0; count < 2; count++) {
        await page.getByTestId("letter-new").click();
        await page.getByTestId(`letters-cv-option-${doomed}`).click();
        await page.getByTestId("letters-cv-create").click();
        await expect(page).toHaveURL(/\/letters\/[^/]+$/, { timeout: 30_000 });
        if (count === 1) {
            await page.getByTestId("letter-mark-sent").click();
            await page.getByTestId("letter-send-confirm").click();
            await expect(page.getByTestId("letter-status-chip")).toHaveText(/Sent/i);
        }
        await page.goto("/dashboard?tab=letters");
    }
    await expect(page.getByTestId("letter-card")).toHaveCount(2);

    // Delete the CV: the dialog counts both letters, the sent one needs no choice.
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-resume-card").filter({ hasText: "Doomed Person" }).getByRole("button", { name: "Delete resume" }).click();
    const dialog = page.getByTestId("delete-cv-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("delete-cv-summary")).toContainText("(2)");
    await expect(page.getByTestId("delete-cv-draft")).toHaveCount(1);
    await expect(page.getByTestId("delete-cv-confirm")).toBeDisabled();
    await dialog.locator('select[data-testid^="delete-choice-"]').first().selectOption(`link:${survivor}`);
    await page.getByTestId("delete-cv-confirm").click();
    await expect(dialog).toBeHidden();

    // Both letters are still there: the draft under the other CV, the sent one with no CV.
    await page.goto("/dashboard?tab=letters");
    await expect(page.getByTestId("letter-card")).toHaveCount(2);
    await expect(page.getByTestId(`letters-group-${survivor}`).getByTestId("letter-card")).toHaveCount(1);
    await expect(page.getByTestId("letters-group-none").getByTestId("letter-status")).toHaveText(/Sent/i);
});

test("a letter exports as plain text, Word and PDF with the same content as on screen", async ({ page }) => {
    await createBlankResume(page);
    const cvId = page.url().split("/").pop()!;
    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-name-input").fill("Export Person");
    await expect.poll(() => storedCvName(page, cvId), { timeout: 15_000 }).toBe("Export Person");
    await page.getByTestId("editor-write-letter").click();
    await expect(page).toHaveURL(/\/letters\/[^/]+$/, { timeout: 30_000 });

    await page.getByTestId("letter-company").fill("Acme");
    await page.getByTestId("letter-paragraph-input-0").fill("I would love to join {{name}}'s future team.");
    await expect(firstPage(page)).toContainText("Export Person's future team");

    // The same export dialog as the CV. The sender has no email, so it lists that, and still exports.
    await page.getByTestId("export-menu-button").click();
    await expect(page.getByTestId("letter-export-warnings")).toContainText(/Email is empty/);
    await page.getByTestId("export-format-txt").click();
    const [textDownload] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-confirm-button").click()]);
    expect(textDownload.suggestedFilename()).toBe("cover-letter-acme.txt");
    const text = await (await import("node:fs/promises")).readFile((await textDownload.path())!, "utf8");
    expect(text).toContain("Export Person");
    expect(text).toContain("Export Person's future team");
    expect(text).not.toContain("{{");

    // Word.
    await page.getByTestId("export-menu-button").click();
    await page.getByTestId("export-format-docx").click();
    const [docxDownload] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-confirm-button").click()]);
    expect(docxDownload.suggestedFilename()).toBe("cover-letter-acme.docx");
    expect((await (await import("node:fs/promises")).stat((await docxDownload.path())!)).size).toBeGreaterThan(2000);

    // PDF: the print window gets the preview's pages.
    await page.getByTestId("export-menu-button").click();
    await page.getByTestId("export-format-pdf").click();
    const [popup] = await Promise.all([page.waitForEvent("popup"), page.getByTestId("export-confirm-button").click()]);
    await popup.waitForLoadState();
    await expect(popup.locator(".resume-page").first()).toContainText("Export Person's future team");
    // Token highlights must not reach the printed page.
    await expect(popup.locator('[data-letter-chip="unresolved"]')).toBeHidden();
});

test("the German layout switches the letter to A4 and shows the address field and fold marks", async ({ page }) => {
    await createBlankResume(page);
    await page.getByTestId("editor-write-letter").click();
    await expect(page).toHaveURL(/\/letters\/[^/]+$/, { timeout: 30_000 });

    // Start on US Letter, then choose the German layout.
    await page.getByTestId("letter-paper").selectOption("letter");
    await expect.poll(() => pageWidth(page)).toBeCloseTo(816, 0);
    await page.getByTestId("letter-layout").selectOption("din5008");
    await expect(page.getByTestId("letter-layout-notice")).toBeVisible();
    await expect.poll(() => pageWidth(page)).toBeCloseTo(794, 0);
    await expect(firstPage(page).locator('[data-din="address-field"]')).toBeVisible();
    await expect(page.locator("[data-fold-mark]").first()).toBeAttached();

    // Back to the standard layout: Letter returns, the marks and the address field go.
    await page.getByTestId("letter-layout").selectOption("standard");
    await expect.poll(() => pageWidth(page)).toBeCloseTo(816, 0);
    await expect(page.locator('[data-din="address-field"]')).toHaveCount(0);
});

test("letters survive download all data, delete all data and import", async ({ page }) => {
    test.setTimeout(120_000);
    // A CV with a name, and a letter for it.
    await createBlankResume(page);
    const cvId = page.url().split("/").pop()!;
    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-name-input").fill("Roundtrip Person");
    await expect.poll(() => storedCvName(page, cvId), { timeout: 15_000 }).toBe("Roundtrip Person");
    await page.getByTestId("editor-write-letter").click();
    await expect(page).toHaveURL(/\/letters\/[^/]+$/, { timeout: 30_000 });
    await page.getByTestId("letter-company").fill("Roundtrip Co");
    await expect(page.getByTestId("letter-save-state")).toContainText(/Saved/);

    // Download everything.
    await page.goto("/your-data");
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("your-data-download").getByRole("button", { name: "Download my data" }).click();
    const path = (await (await downloadPromise).path())!;

    // Delete everything.
    await page.getByRole("button", { name: "Delete all my data" }).click();
    const dialog = page.getByTestId("delete-all-data-dialog");
    await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
    await dialog.getByRole("button", { name: "Delete everything" }).click();
    await expect(dialog.getByTestId("deletion-result")).toHaveAttribute("data-status", "complete");

    // Import the file: the CV and its letter come back, linked.
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-import-json-input").setInputFiles(path);
    await expect(page.getByText(/Imported 1 CV from your data export/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/1 letter restored/)).toBeVisible();

    await page.goto("/dashboard?tab=letters");
    const group = page.locator('[data-testid^="letters-group-"]').filter({ hasText: "Roundtrip Person" });
    await expect(group).toBeVisible();
    await expect(group.getByTestId("letter-card")).toHaveCount(1);
    await expect(group.getByTestId("letter-card")).toContainText("Roundtrip Co");
});

test("writing, saving, freezing and exporting a letter work with no network", async ({ page, context }) => {
    test.setTimeout(90_000);
    await createBlankResume(page);
    const cvId = page.url().split("/").pop()!;
    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-name-input").fill("Offline Person");
    await expect.poll(() => storedCvName(page, cvId), { timeout: 15_000 }).toBe("Offline Person");
    await page.getByTestId("editor-write-letter").click();
    await expect(page).toHaveURL(/\/letters\/[^/]+$/, { timeout: 30_000 });
    await expect(firstPage(page)).toContainText("Offline Person");

    // The page is loaded; cut the network. Nothing below needs it.
    await context.setOffline(true);

    await page.getByTestId("letter-paragraph-input-0").fill("Written without a connection.");
    await expect(page.getByTestId("letter-save-state")).toContainText(/Saved/);

    await page.getByTestId("letter-mark-sent").click();
    await page.getByTestId("letter-send-confirm").click();
    await expect(page.getByTestId("letter-status-chip")).toHaveText(/Sent/i);

    await page.getByTestId("export-menu-button").click();
    await page.getByTestId("export-format-txt").click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-confirm-button").click()]);
    const text = await (await import("node:fs/promises")).readFile((await download.path())!, "utf8");
    expect(text).toContain("Written without a connection.");

    await page.getByTestId("letter-unfreeze").click();
    await page.getByRole("dialog").getByRole("button", { name: "Unfreeze" }).click();
    await expect(page.getByTestId("letter-status-chip")).toHaveText(/Draft/i);
    await context.setOffline(false);
});

test("a CV that fails strict validation (an invalid email) still gets a letter", async ({ page }) => {
    await createBlankResume(page);
    const cvId = page.url().split("/").pop()!;
    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-name-input").fill("Master Person");
    await expect.poll(() => storedCvName(page, cvId), { timeout: 15_000 }).toBe("Master Person");

    // Leave the editor, then put a value in the stored CV that the strict schema rejects.
    await page.goto("/privacy");
    await page.evaluate(async (id) => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("EngineCVDatabase");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction("resumes", "readwrite");
            const store = transaction.objectStore("resumes");
            const read = store.get(id);
            read.onsuccess = () => {
                store.put({ ...read.result, basics: { ...read.result.basics, email: "not-an-email" } });
            };
            transaction.oncomplete = () => { database.close(); resolve(); };
            transaction.onerror = () => reject(transaction.error);
        });
    }, cvId);

    await page.goto("/dashboard?tab=letters");
    await page.getByTestId("letter-new").click();
    await page.getByTestId("letters-cv-create").click(); // the first CV is preselected
    await expect(page).toHaveURL(/\/letters\/[^/]+$/, { timeout: 30_000 });
    await expect(firstPage(page)).toContainText("Master Person");
});

test("the form and preview panels resize by dragging the separator, like the CV editor", async ({ page }) => {
    await createBlankResume(page);
    await page.getByTestId("editor-write-letter").click();
    await expect(page).toHaveURL(/\/letters\/[^/]+$/, { timeout: 30_000 });
    await expect(page.getByTestId("letter-form")).toBeVisible();

    const separator = page.getByRole("separator");
    await expect(separator).toBeVisible();
    const before = (await page.getByTestId("letter-form").boundingBox())!.width;
    const handle = (await separator.boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + 160, handle.y + handle.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect.poll(async () => (await page.getByTestId("letter-form").boundingBox())!.width).toBeGreaterThan(before + 60);

    // The preview shrinks to make room, and still shows the letter.
    await expect(page.getByTestId("letter-page").first()).toBeVisible();
});

test("paragraphs are a list: start with one, add more, reorder and remove", async ({ page }) => {
    await createBlankResume(page);
    await page.getByTestId("editor-write-letter").click();
    await expect(page).toHaveURL(/\/letters\/[^/]+$/, { timeout: 30_000 });

    await expect(page.getByTestId(/^letter-paragraph-card-\d+$/)).toHaveCount(1);
    await page.getByTestId("letter-paragraph-input-0").fill("First paragraph");
    await page.getByTestId("letter-paragraph-add").click();
    await page.getByTestId("letter-paragraph-add").click();
    await expect(page.getByTestId(/^letter-paragraph-card-\d+$/)).toHaveCount(3);
    await page.getByTestId("letter-paragraph-input-2").fill("Third paragraph");

    // Move the last one up; the preview follows the new order.
    await page.getByTestId("letter-paragraph-up-2").click();
    await expect(page.getByTestId("letter-paragraph-input-1")).toHaveValue("Third paragraph");
    const text = await page.getByTestId("letter-page").first().innerText();
    expect(text.indexOf("First paragraph")).toBeLessThan(text.indexOf("Third paragraph"));

    await page.getByTestId("letter-paragraph-remove-1").click();
    await expect(page.getByTestId(/^letter-paragraph-card-\d+$/)).toHaveCount(2);
});

test("a CV card starts a letter, shows how many it has and opens them filtered", async ({ page }) => {
    await createBlankResume(page);
    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-resume-letters")).toHaveCount(0);

    await page.getByRole("button", { name: "Write a cover letter for this CV" }).first().click();
    await expect(page).toHaveURL(/\/letters\/[^/]+$/);

    await page.goto("/dashboard");
    const chip = page.getByTestId("dashboard-resume-letters").first();
    await expect(chip).toHaveText("1");
    await chip.click();
    await expect(page.getByTestId("letters-filter")).toBeVisible();
    await expect(page.getByTestId("letter-card")).toHaveCount(1);
    await page.getByTestId("letters-filter-clear").click();
    await expect(page.getByTestId("letters-filter")).toHaveCount(0);
});

test("a letter can be written without a CV, styled on its own, and sent", async ({ page }) => {
    // No CV at all: New letter starts a standalone letter.
    await page.goto("/dashboard?tab=letters");
    await page.getByTestId("letter-new").click();
    await expect(page).toHaveURL(/\/letters\/[^/]+$/, { timeout: 30_000 });
    await expect(page.getByTestId("letter-status-text")).toContainText("no CV");

    // The person types the sender block; only the name token is offered.
    await page.getByTestId("letter-sender-name").fill("Sam Sender");
    await page.getByTestId("letter-sender-email").fill("sam@example.com");
    await expect(firstPage(page)).toContainText("Sam Sender");
    await expect(page.getByTestId("letter-token-name")).toBeVisible();
    await expect(page.getByTestId("letter-token-role")).toHaveCount(0);

    // Design controls mark what changed and can be reset.
    await expect(page.getByTestId("letter-design-changed-headerTextTransform")).toHaveCount(0);
    await page.getByTestId("letter-design-caps").click();
    await page.getByText("UPPERCASE", { exact: true }).click();
    await expect(page.getByTestId("letter-design-changed-headerTextTransform")).toBeVisible();
    await page.getByTestId("letter-design-reset-all").click();
    await expect(page.getByTestId("letter-design-changed-headerTextTransform")).toHaveCount(0);
    await expect(page.getByTestId("letter-save-state")).toContainText(/Saved/);

    // It sits in its own group on the dashboard, without a "needs a CV" warning.
    await page.goto("/dashboard?tab=letters");
    await expect(page.getByTestId("letters-group-standalone")).toBeVisible();
    await expect(page.getByTestId("letter-needs-cv")).toHaveCount(0);

    // Sending needs no CV.
    await page.getByTestId("letter-card").first().getByRole("button", { name: /^Open / }).click();
    await page.getByTestId("letter-mark-sent").click();
    await page.getByTestId("letter-send-confirm").click();
    await expect(page.getByTestId("letter-status-chip")).toContainText(/Sent/i);
});
