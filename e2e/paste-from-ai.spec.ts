import { expect, test, type Page } from "@playwright/test";
import { createCvFromHub, hubDialog } from "./helpers/import-hub";

/** Types or pastes text into the window and adds it as a source. */
async function addPasted(page: Page, text: string) {
    await page.getByTestId("paste-from-ai-input").fill(text);
    await page.getByTestId("paste-from-ai-add").click();
    await expect(page.getByTestId("import-hub-batch")).toHaveCount(1);
}

// What a chat assistant typically answers: prose, a fenced block, a trailing comma.
const AI_ANSWER = [
    "Sure! Here is your CV in the EngineCV format:",
    "",
    "```json",
    "{",
    '  "format": "enginecv.authoring/v1",',
    '  "basics": { "name": "Lejla Paste-Test", "headline": "ICU Nurse" },',
    '  "experience": [',
    '    { "position": "Medicinska sestra", "company": "KCUS", "start": "2019-03", "end": "present" },',
    "  ],",
    '  "skills": ["Intensive care", "Wound care (expert)"]',
    "}",
    "```",
    "",
    "Let me know if you want any changes.",
].join("\n");

async function openFromCreateMenu(page: Page) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-ai").click();
    await expect(hubDialog(page)).toBeVisible();
}

test("pastes an AI answer, shows the repairs and opens the new CV in the editor", async ({ page }) => {
    const external: string[] = [];
    await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
            await route.continue();
            return;
        }
        external.push(url.href);
        await route.abort();
    });

    await openFromCreateMenu(page);
    await addPasted(page, AI_ANSWER);

    const repaired = page.getByTestId("paste-from-ai-notice-group-repaired");
    await expect(repaired).toContainText("Took the CV out of a code block.");
    await expect(repaired).toContainText("Ignored the text around the CV.");
    await expect(repaired).toContainText("Removed extra commas.");
    await expect(page.getByTestId("paste-from-ai-section-experience")).toContainText("1 entry");
    await expect(page.getByTestId("paste-from-ai-section-skills")).toContainText("2 skills");

    await createCvFromHub(page);

    // The preview also renders hidden measuring copies; only the visible text counts.
    for (const text of ["Lejla Paste-Test", "Medicinska sestra", "Wound care"]) {
        await expect(page.locator(`text=${text} >> visible=true`).first()).toBeVisible();
    }
    expect(external).toEqual([]);
});

test("copies the instructions and links the published schema", async ({ page, context, request }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openFromCreateMenu(page);

    await page.getByTestId("paste-from-ai-copy-instructions").click();
    await expect(page.getByTestId("paste-from-ai-copy-status")).toContainText("Instructions copied.");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("enginecv.authoring/v1");
    expect(copied).toContain("Never invent employers");

    const href = await page.getByTestId("paste-from-ai-format-link").getAttribute("href");
    const schema = await request.get(href!);
    expect(schema.status()).toBe(200);
    expect(schema.headers()["content-type"]).toBe("application/schema+json; charset=utf-8");
    expect(schema.headers()["access-control-allow-origin"]).toBe("*");
    expect((await schema.json()).$id).toBe("https://enginecv.app/schema/authoring/v1.json");
});

/** Every saved resume, straight from IndexedDB. */
async function savedResumes(page: Page): Promise<Array<Record<string, unknown> & { id: string }>> {
    return page.evaluate(() => new Promise((resolve, reject) => {
        const open = indexedDB.open("EngineCVDatabase");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
            const request = open.result.transaction("resumes").objectStore("resumes").getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        };
    }));
}

/** The parts of a resume a round trip must keep (ids and design aside). */
function contentOf(resume: Record<string, unknown>) {
    const strip = (value: unknown): unknown => {
        if (Array.isArray(value)) return value.map(strip);
        if (value && typeof value === "object") {
            return Object.fromEntries(Object.entries(value)
                // An empty date and a missing one mean the same.
                .filter(([key, item]) => !["id", "urlIcon", "icon", "display"].includes(key) && item !== "" && item !== undefined)
                .map(([key, item]) => [key, strip(item)]));
        }
        return value;
    };
    const { basics, experience, education, skillGroups, languages, projects, certificates } = resume as Record<string, unknown>;
    const { photo, photoEdit, detailsOrder, emails, customLinks, ...rest } = basics as Record<string, unknown>;
    void photo; void photoEdit; void detailsOrder; void emails; void customLinks;
    return strip({ basics: rest, experience, education, skillGroups, languages, projects, certificates });
}

test("Copy for AI and Paste from AI round-trip an example CV", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/dashboard?start=example");
    await page.getByTestId("example-role-nurse").click();
    await page.waitForURL(/\/editor\/[^/]+$/);
    const [original] = await savedResumes(page);

    await page.getByTestId("export-menu-button").first().click();
    await page.getByTestId("export-copy-for-ai-button").click();
    await expect(page.getByTestId("export-copy-for-ai-button")).toHaveText(/Copied/);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("enginecv.authoring/v1");

    await page.goto("/dashboard?start=ai");
    await addPasted(page, copied);
    await expect(page.getByTestId("paste-from-ai-summary")).toBeVisible();
    await expect(page.getByTestId("paste-from-ai-notice")).toHaveCount(0);
    await createCvFromHub(page);
    expect(page.url().endsWith(original.id)).toBe(false);

    const copy = (await savedResumes(page)).find((resume) => resume.id !== original.id)!;
    expect(contentOf(copy)).toEqual(contentOf(original));
});

const FILE_DOCUMENT = JSON.stringify({
    format: "enginecv.authoring/v1",
    basics: { name: "Dropped File Person" },
    experience: [{ position: "Engineer", company: "Acme", start: "2020-01" }],
}, null, 2);

/** Drags a file over the page and drops it, the way a browser does. */
async function dropFile(page: Page, file: { name: string; type: string; text: string }) {
    const dataTransfer = await page.evaluateHandle(({ name, type, text }) => {
        const transfer = new DataTransfer();
        transfer.items.add(new File([text], name, { type }));
        return transfer;
    }, file);
    await page.dispatchEvent("main", "dragenter", { dataTransfer });
    await expect(page.getByTestId("dashboard-drop-overlay")).toBeVisible();
    await page.dispatchEvent("main", "dragover", { dataTransfer });
    await page.dispatchEvent("main", "drop", { dataTransfer });
    await expect(page.getByTestId("dashboard-drop-overlay")).toHaveCount(0);
}

test("a dropped .enginecv.json file goes through the same summary into the editor", async ({ page }) => {
    await page.goto("/dashboard");
    await dropFile(page, { name: "amina.enginecv.json", type: "application/json", text: FILE_DOCUMENT });

    await expect(page.getByTestId("import-hub-dialog")).toBeVisible();
    await expect(page.getByTestId("paste-from-ai-summary-name")).toContainText("Dropped File Person");
    await expect(page.getByTestId("paste-from-ai-section-experience")).toContainText("1 entry");
    await createCvFromHub(page);
});

test("Import JSON routes an authoring file to the summary", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-import-resume-input").setInputFiles({
        name: "cv.json",
        mimeType: "application/json",
        buffer: Buffer.from(FILE_DOCUMENT),
    });
    await expect(hubDialog(page)).toBeVisible();
    await expect(page.getByTestId("paste-from-ai-summary-name")).toContainText("Dropped File Person");
});

test("a dropped file that is not JSON is refused and creates nothing", async ({ page }) => {
    await page.goto("/dashboard");
    await dropFile(page, { name: "notes.txt", type: "text/plain", text: "just notes" });
    await expect(page.getByText("Only JSON, ZIP, CSV, PDF and XML files can be dropped here. Nothing was imported.")).toBeVisible();
    await expect(hubDialog(page)).toHaveCount(0);
    expect(await savedResumes(page)).toEqual([]);
});

// Twenty notes: each experience entry has a date the parser cannot read.
const MANY_NOTES = JSON.stringify({
    basics: { name: "Long Notes Person" },
    experience: Array.from({ length: 19 }, (_, index) => ({ position: `Role ${index}`, start: `spring ${2000 + index}` })),
});

for (const locale of ["de", "bs"] as const) {
    test(`fits a 360 px screen in ${locale} with twenty notes`, async ({ page }) => {
        await page.addInitScript((value) => {
            if (!window.localStorage.getItem("enginecv-preferences")) window.localStorage.setItem("enginecv-locale", value);
        }, locale);
        await page.setViewportSize({ width: 360, height: 780 });
        await page.goto("/dashboard?start=ai");
        await expect(page.locator("html")).toHaveAttribute("lang", locale);

        await addPasted(page, MANY_NOTES);
        await expect(page.getByTestId("paste-from-ai-notice")).toHaveCount(20);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        const dialog = await hubDialog(page).boundingBox();
        expect(dialog!.width).toBeLessThanOrEqual(360);
        // Long notes scroll inside the window, so Review stays reachable.
        await expect(page.getByTestId("import-hub-review")).toBeInViewport();
    });
}

test("opens Paste from AI from a ?start=ai link", async ({ page }) => {
    await page.goto("/dashboard?start=ai");
    await expect(page.getByTestId("import-hub-dialog")).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
});
