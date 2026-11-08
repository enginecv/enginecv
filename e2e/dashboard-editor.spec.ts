import { expect, test, type Page } from "@playwright/test";

async function setStoredLocale(page: Page, locale: string) {
    await page.addInitScript((storedLocale: string) => {
        window.localStorage.setItem("enginecv-locale", storedLocale);
        document.cookie = `enginecv-locale=${storedLocale}; path=/`;
    }, locale);
}

async function expectContentTabActive(page: Page) {
    await expect(page.getByTestId("sidebar-tab-content")).toHaveAttribute("data-state", "active");
    await expect(page.getByTestId("sidebar-tab-customize")).toHaveAttribute("data-state", "inactive");
}

async function expandCustomizeSection(page: Page, heading: string) {
    const sectionIds: Record<string, string> = {
        "Document Units": "documentUnits",
        "Spacing": "spacing",
        "Language & Region": "languageRegion",
    };
    const row = page.getByTestId(`customize-row-${sectionIds[heading]}`);
    if (!await row.isVisible()) {
        await page.getByRole("button", { name: "Whole resume" }).click();
    }
    await row.click();
}

async function createBlankResume(page: Page, options?: { locale?: string }) {
    if (options?.locale) {
        await setStoredLocale(page, options.locale);
    }

    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-scratch").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    await expectContentTabActive(page);
}

async function addExperienceEntry(page: Page) {
    await page.getByTestId("add-content-experience").click();
    await page.getByTestId("entry-input-position").fill("Senior Engineer");
    await page.getByTestId("entry-input-company").fill("Acme Systems");
    await page.getByTestId("entry-input-location").fill("Remote");
}

test("opens a newly created resume on the content tab first", async ({ page }) => {
    await createBlankResume(page);

    await expectContentTabActive(page);
    await expect(page.getByTestId("sidebar-basics-card")).toBeVisible();
});

test("keeps the content tab default for repeated same-session resume creation", async ({ page }) => {
    await createBlankResume(page);

    await page.getByTestId("sidebar-tab-customize").click();
    await expect(page.getByTestId("sidebar-tab-customize")).toHaveAttribute("data-state", "active");

    await createBlankResume(page);

    await expectContentTabActive(page);
});

test("reopens an existing resume on the content tab after leaving another session on customize", async ({ page }) => {
    const name = "Default Content Reopen Check";

    await createBlankResume(page);
    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-name-input").fill(name);

    await page.waitForTimeout(500);
    await expect(page.getByText(/Saved at/)).toBeVisible();
    const resumeId = new URL(page.url()).pathname.split("/").pop()!;
    await expect.poll(() => page.evaluate(async (id) => {
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
    }, resumeId), { timeout: 15_000 }).toBe(name);

    await page.getByTestId("basics-form-back").click();
    await page.getByTestId("sidebar-tab-customize").click();
    await expect(page.getByTestId("sidebar-tab-customize")).toHaveAttribute("data-state", "active");

    await page.locator('a[href="/dashboard"]').first().click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.locator('[data-testid="dashboard-resume-card"]').filter({ hasText: name }).first().click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    await expectContentTabActive(page);
});

test("keeps the content tab default when the app locale is non-default", async ({ page }) => {
    await createBlankResume(page, { locale: "de" });

    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await expectContentTabActive(page);
});

test("opens a customization detail through the nested command palette", async ({ page }) => {
    await createBlankResume(page);

    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette).toBeVisible();

    const search = palette.getByRole("combobox");
    await search.fill("Customize");
    await page.keyboard.press("Enter");

    await expect(search).toHaveValue("");
    await expect(search).toHaveAttribute("placeholder", "Search customization…");
    await expect(palette.getByText("Appearance", { exact: true })).toBeVisible();
    await expect(palette.getByText("Document", { exact: true })).toBeVisible();
    await expect(palette.getByText("Header", { exact: true })).toBeVisible();

    await search.fill("Typography");
    await page.keyboard.press("Enter");

    await expect(palette).not.toBeVisible();
    await expect(page.getByTestId("sidebar-tab-customize")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("customize-detail-typography")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Typography", exact: true })).toBeVisible();
});

test("dashboard resume thumbnails stay out of the keyboard tab order", async ({ page }) => {
    const title = "Dashboard Focus Preview";

    await createBlankResume(page);
    const resumeId = new URL(page.url()).pathname.split("/").pop()!;
    await page.goto("/dashboard");
    await page.evaluate(async ({ id, title }) => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("EngineCVDatabase");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        await new Promise<void>((resolve, reject) => {
            const tx = database.transaction("resumes", "readwrite");
            const store = tx.objectStore("resumes");
            const request = store.get(id);

            request.onsuccess = () => {
                const resume = request.result;
                if (!resume) {
                    reject(new Error(`Resume ${id} not found`));
                    return;
                }
                store.put({
                    ...resume,
                    meta: {
                        ...resume.meta,
                        title,
                    },
                    basics: {
                        ...resume.basics,
                        name: "Alicia Vector",
                        customLinks: [
                            {
                                id: "portfolio-link",
                                name: "Website",
                                url: "https://example.com",
                                label: "Portfolio",
                                icon: "auto",
                            },
                        ],
                    },
                    updatedAt: Date.now(),
                });
            };
            request.onerror = () => reject(request.error);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }, { id: resumeId, title });

    await page.reload();
    const card = page.getByTestId("dashboard-resume-card").filter({ hasText: title }).first();
    await expect(card).toBeVisible();

    const thumbnail = card.locator('[data-thumbnail-mode="true"]');
    await expect(thumbnail).toBeVisible();
    await expect.poll(async () => thumbnail.locator('a[href^="https://example.com"]').count()).toBeGreaterThan(0);

    const openButtons = card.getByRole("button", { name: `Open ${title}` });
    await openButtons.first().focus();
    await page.keyboard.press("Tab");

    await expect.poll(() => page.evaluate(() => {
        return Boolean(document.activeElement?.closest('[data-thumbnail-mode="true"]'));
    })).toBe(false);
    await expect(openButtons.nth(1)).toBeFocused();
});

test("creates a resume and persists basic edits", async ({ page }) => {
    const name = "Alicia Vector Test";
    const headline = "Platform Engineer";
    const previewName = page.locator('[data-testid="resume-preview-name"]:visible').first();

    await createBlankResume(page);
    await page.getByTestId("sidebar-basics-card").click();

    await page.getByTestId("basics-name-input").fill(name);
    await page.getByTestId("basics-headline-input").fill(headline);

    await expect(previewName).toHaveText(name);
    const resumeId = new URL(page.url()).pathname.split("/").pop()!;
    await expect.poll(() => page.evaluate(async (id) => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("EngineCVDatabase");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return new Promise<{ name: string; headline: string }>((resolve, reject) => {
            const request = database.transaction("resumes", "readonly").objectStore("resumes").get(id);
            request.onsuccess = () => resolve({
                name: request.result?.basics?.name ?? "",
                headline: request.result?.basics?.headline ?? "",
            });
            request.onerror = () => reject(request.error);
        });
    }, resumeId), { timeout: 15_000 }).toEqual({ name, headline });

    await page.reload();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    await page.getByTestId("sidebar-basics-card").click();

    await expect(page.getByTestId("basics-name-input")).toHaveValue(name);
    await expect(page.getByTestId("basics-headline-input")).toHaveValue(headline);
    await expect(previewName).toHaveText(name);
});

test("adds an experience entry and keeps it after reload", async ({ page }) => {
    const previewPage = page.locator(".resume-page").first();

    await createBlankResume(page);
    await addExperienceEntry(page);

    await expect(previewPage.getByText("Experience")).toBeVisible();
    await expect(previewPage.getByText("Senior Engineer")).toBeVisible();
    await expect(previewPage.getByText("Acme Systems")).toBeVisible();

    await page.waitForTimeout(500);
    await expect(page.getByText(/Saved at/)).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    await expect(previewPage.getByText("Senior Engineer")).toBeVisible();
    await expect(previewPage.getByText("Acme Systems")).toBeVisible();
});

test("switches measurement units in customize mode and persists the choice", async ({ page }) => {
    await createBlankResume(page);

    await page.getByTestId("sidebar-tab-customize").click();
    await expect(page.getByTestId("customize-row-templates")).toBeVisible();
    await expect(page.getByTestId("customize-row-documentUnits")).toBeVisible();
    await expandCustomizeSection(page, "Document Units");
    await page.getByTestId("measurement-system-select").click();
    await page.getByTestId("measurement-system-option-imperial").click();

    await expandCustomizeSection(page, "Spacing");
    await expect(page.getByTestId("spacing-margin-h-display")).toContainText("in");

    await page.waitForTimeout(500);
    await expect(page.getByText(/Saved at/)).toBeVisible();

    await page.reload();
    await page.getByTestId("sidebar-tab-customize").click();
    await expandCustomizeSection(page, "Spacing");
    await expect(page.getByTestId("spacing-margin-h-display")).toContainText("in");
});

test("keeps the first following section on page 1 after summary edits and reload", async ({ page }) => {
    const summary = [
        "Product-minded platform engineer focused on local-first editing and resilient export flows.",
        "Builds responsive tools that keep pagination and persistence trustworthy during active edits.",
        "Works closely with multilingual product teams to keep resume output stable across locales.",
        "Protects final output parity by fixing issues in shared rendering paths instead of one-off template patches.",
    ].join("\n");

    await createBlankResume(page);
    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-summary-input").fill(summary);
    await page.getByTestId("basics-form-back").click();
    await addExperienceEntry(page);

    const pageOne = page.getByTestId("resume-preview-page-1");
    await expect(pageOne.getByTestId("resume-preview-summary")).toBeVisible();
    await expect(pageOne.locator('[data-preview-section-heading="experience"]')).toBeVisible();
    await expect(page.locator(".resume-page")).toHaveCount(1);

    await page.waitForTimeout(500);
    await expect(page.getByText(/Saved at/)).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    await page.getByTestId("sidebar-basics-card").click();
    await expect(page.getByTestId("basics-summary-input")).toHaveValue(summary);
    await expect(page.getByTestId("resume-preview-page-1").locator('[data-preview-section-heading="experience"]')).toBeVisible();
    await expect(page.locator(".resume-page")).toHaveCount(1);
});

test("moves following sections only when a multi-line summary actually overflows", async ({ page }) => {
    const longSummary = Array.from(
        { length: 42 },
        (_, index) => `Line ${index + 1}: Preserved local-first resume editing trust during heavy preview changes.`,
    ).join("\n");

    await createBlankResume(page);
    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-summary-input").fill(longSummary);
    await page.getByTestId("basics-form-back").click();
    await addExperienceEntry(page);

    await expect(page.getByTestId("resume-preview-page-2")).toBeVisible();
    await expect(page.locator('.resume-page [data-testid="resume-preview-summary"]').first()).toBeVisible();
    await expect(page.getByTestId("resume-preview-page-1").locator('[data-preview-section-heading="experience"]')).toHaveCount(0);
    await expect(page.locator('.resume-page [data-preview-section-heading="experience"]').first()).toBeVisible();
});

test("keeps summary pagination stable when switching the resume locale", async ({ page }) => {
    const summary = [
        "Experienced engineer protecting local-first resume workflows.",
        "Improves export trust and live preview responsiveness across supported languages.",
    ].join("\n");

    await createBlankResume(page);
    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-summary-input").fill(summary);
    await page.getByTestId("basics-form-back").click();
    await addExperienceEntry(page);

    await expect(page.getByTestId("resume-preview-page-1").locator('[data-preview-section-heading="experience"]')).toBeVisible();
    await page.getByTestId("section-form-back").click();

    await page.getByTestId("sidebar-tab-customize").click();
    await expandCustomizeSection(page, "Language & Region");
    await page.getByTestId("language-select").click();
    await page.getByTestId("language-option-de").click();

    const pageOne = page.getByTestId("resume-preview-page-1");
    await expect(pageOne.getByTestId("resume-preview-summary")).toContainText("Zusammenfassung");
    await expect(pageOne.locator('[data-preview-section-heading="experience"]')).toBeVisible();

    await page.waitForTimeout(500);
    await expect(page.getByText(/Saved at/)).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    await expect(page.getByTestId("resume-preview-page-1").getByTestId("resume-preview-summary")).toContainText("Zusammenfassung");
    await expect(page.getByTestId("resume-preview-page-1").locator('[data-preview-section-heading="experience"]')).toBeVisible();
});

test("persists verifiable language assessments and clears them for Native proficiency", async ({ page }) => {
    await createBlankResume(page);
    await page.getByPlaceholder("Search content types").fill("Languages");
    await page.getByTestId("add-content-languages").click();
    await page.getByTestId("entry-input-language").fill("English");
    await page.getByRole("button", { name: "Issued by an organisation" }).click();
    await page.getByPlaceholder("Goethe-Institut, IELTS, TOEFL...").fill("IELTS");
    await page.getByPlaceholder("Certificate or result number").fill("TRF-12345");
    await page.getByPlaceholder("https://issuer.example/verify/...").fill("https://ielts.org/verify/TRF-12345");

    const preview = page.locator(".resume-page").first();
    await expect(preview.getByRole("link", { name: /Issued by an organisation: IELTS/ })).toHaveAttribute(
        "href",
        "https://ielts.org/verify/TRF-12345",
    );
    await expect(preview.getByText("Assessment ID: TRF-12345")).toBeVisible();

    await page.getByRole("button", { name: "Native" }).click();
    await expect(page.getByText("Native proficiency does not need an assessment.")).toBeVisible();
    await expect(preview.getByRole("link", { name: /Issued by an organisation/ })).toHaveCount(0);

    await page.waitForTimeout(500);
    await expect(page.getByText(/Saved at/)).toBeVisible();
    const resumeId = new URL(page.url()).pathname.split("/").pop()!;
    const language = await page.evaluate(async (id) => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("EngineCVDatabase");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return new Promise<Record<string, string>>((resolve, reject) => {
            const request = database.transaction("resumes", "readonly").objectStore("resumes").get(id);
            request.onsuccess = () => resolve(request.result.languages[0]);
            request.onerror = () => reject(request.error);
        });
    }, resumeId);

    expect(language).toMatchObject({
        fluency: "Native",
        assessmentType: "none",
        issuer: "",
        assessmentId: "",
        assessmentUrl: "",
    });
});
