import { expect, test, type Page } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers/a11y";

// Linked file and agent skill (feature 089).
// The OS file picker cannot be driven, so the pickers are replaced with ones that hand out real
// handles from the browser's origin-private file system: they behave like picked files
// (read, atomic write, move, structured clone into IndexedDB) and a test plays the part of
// an outside program by writing the same file.

const FILE = "e2e-cv.enginecv.json";

async function installPickers(page: Page) {
    await page.addInitScript(() => {
        const w = window as unknown as Record<string, unknown>;
        const root = () => navigator.storage.getDirectory();
        w.__pickName = "e2e-cv.enginecv.json";
        w.showSaveFilePicker = async () => (await root()).getFileHandle(w.__pickName as string, { create: true });
        w.showOpenFilePicker = async () => [await (await root()).getFileHandle(w.__pickName as string)];
    });
}

async function fileText(page: Page, name = FILE): Promise<string | null> {
    return page.evaluate(async (fileName) => {
        try {
            const handle = await (await navigator.storage.getDirectory()).getFileHandle(fileName);
            return await (await handle.getFile()).text();
        } catch {
            return null;
        }
    }, name);
}

/** What an outside program does: replace the file's content. */
async function outsideWrite(page: Page, text: string, name = FILE) {
    await page.evaluate(async ({ fileName, content }) => {
        const handle = await (await navigator.storage.getDirectory()).getFileHandle(fileName);
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
    }, { fileName: name, content: text });
}

async function outsideRename(page: Page, from: string, to: string) {
    await page.evaluate(async ({ source, target }) => {
        const handle = await (await navigator.storage.getDirectory()).getFileHandle(source);
        await (handle as unknown as { move(name: string): Promise<void> }).move(target);
    }, { source: from, target: to });
}

async function clearOpfs(page: Page) {
    await page.evaluate(async () => {
        const root = await navigator.storage.getDirectory();
        for await (const name of (root as unknown as { keys(): AsyncIterable<string> }).keys()) await root.removeEntry(name);
    });
}

async function createBlankResume(page: Page) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-scratch").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    await page.addStyleTag({ content: "nextjs-portal { display: none; }" });
}

/** The panel closes when the privacy dialog takes focus; open it again when a test needs it. */
async function showPanel(page: Page) {
    if (!(await page.getByTestId("linked-file-panel").isVisible())) await page.getByTestId("linked-file-trigger").click();
    await expect(page.getByTestId("linked-file-panel")).toBeVisible();
}

async function linkNewFile(page: Page) {
    await page.getByTestId("linked-file-trigger").click();
    await page.getByTestId("linked-file-create").click();
    await page.getByTestId("linked-file-privacy-continue").click();
    await expect(page.getByTestId("linked-file-trigger")).toContainText(FILE);
    await expect(page.getByTestId("linked-file-live")).toContainText(/Synced/);
}

const doc = (body: Record<string, unknown>) =>
    JSON.stringify({ format: "enginecv.authoring/v1", basics: { name: "Amina Hodzic" }, ...body }, null, 2);

test.beforeEach(async ({ page }) => {
    await installPickers(page);
});

test.describe("linked file", () => {
    test("follows an outside edit within seconds and writes editor changes back", async ({ page }) => {
        await createBlankResume(page);
        await page.getByTestId("sidebar-basics-card").click();
        await page.getByTestId("basics-name-input").fill("Amina Hodzic");
        await linkNewFile(page);

        // The file holds the CV.
        await expect.poll(async () => JSON.parse((await fileText(page)) ?? "{}").basics?.name).toBe("Amina Hodzic");

        // An outside program adds a project: no import step.
        await outsideWrite(page, doc({ projects: [{ name: "Weather Bot", description: "Daily forecasts" }] }));
        await expect(page.getByTestId("linked-file-update")).toContainText("Updated from file", { timeout: 3500 });
        await expect(page.locator(".resume-page").first()).toContainText("Weather Bot");

        // An editor change reaches the file.
        await page.getByTestId("basics-name-input").fill("Amina H.");
        await expect.poll(async () => JSON.parse((await fileText(page)) ?? "{}").basics?.name, { timeout: 5000 }).toBe("Amina H.");
    });

    test("an invalid file changes nothing and is not overwritten; fixing it recovers", async ({ page }) => {
        await createBlankResume(page);
        await page.getByTestId("sidebar-basics-card").click();
        await page.getByTestId("basics-name-input").fill("Amina Hodzic");
        await linkNewFile(page);

        const broken = '{\n  "format": "enginecv.authoring/v1",\n  "basics": { "name": }\n}';
        await outsideWrite(page, broken);
        await expect(page.getByTestId("linked-file-trigger")).toBeVisible();
        await expect.poll(async () => (await page.getByTestId("linked-file-live").textContent()) ?? "", { timeout: 4500 }).toContain("problem");
        await showPanel(page);
        await expect(page.getByTestId("linked-file-error")).toContainText("Line 3");
        expect(await fileText(page)).toBe(broken);
        await expect(page.getByTestId("basics-name-input")).toHaveValue("Amina Hodzic");

        await outsideWrite(page, doc({ projects: [{ name: "Recovered" }] }));
        await expect(page.getByTestId("linked-file-live")).toContainText(/Synced/, { timeout: 4500 });
        await expect(page.locator(".resume-page").first()).toContainText("Recovered");
    });

    test("two quick outside writes apply once", async ({ page }) => {
        await createBlankResume(page);
        await linkNewFile(page);
        await outsideWrite(page, doc({ projects: [{ name: "First" }] }));
        await page.waitForTimeout(150);
        await outsideWrite(page, doc({ projects: [{ name: "Second" }] }));
        await expect(page.locator(".resume-page").first()).toContainText("Second", { timeout: 5000 });
        await expect(page.locator(".resume-page").first()).not.toContainText("First");
    });

    test("an outside rename breaks the link without touching the CV, and relinking adopts the new name", async ({ page }) => {
        await createBlankResume(page);
        await page.getByTestId("sidebar-basics-card").click();
        await page.getByTestId("basics-name-input").fill("Amina Hodzic");
        await linkNewFile(page);

        await outsideRename(page, FILE, "moved.enginecv.json");
        await expect(page.getByTestId("linked-file-live")).toContainText("not found", { timeout: 4500 });
        await showPanel(page);
        await expect(page.getByTestId("basics-name-input")).toHaveValue("Amina Hodzic");

        await page.evaluate(() => { (window as unknown as Record<string, unknown>).__pickName = "moved.enginecv.json"; });
        await page.getByTestId("linked-file-relink").click();
        await page.getByTestId("linked-file-load").click();
        await expect(page.getByTestId("linked-file-trigger")).toContainText("moved.enginecv.json");
        await expect(page.getByTestId("cv-title-input")).toHaveValue("moved");
    });

    test("renaming a linked CV is refused: the file is never renamed or replaced", async ({ page }) => {
        await createBlankResume(page);
        await linkNewFile(page);
        // A file that already has the target name must survive untouched.
        await page.evaluate(async () => {
            const root = await navigator.storage.getDirectory();
            const other = await root.getFileHandle("Other CV.enginecv.json", { create: true });
            const writable = await other.createWritable();
            await writable.write("precious");
            await writable.close();
        });
        const title = page.getByTestId("cv-title-input");
        await title.fill("Other CV");
        await title.press("Enter");
        await expect(page.getByTestId("cv-title-error")).toContainText("Rename the file in your file manager");
        await expect(title).toHaveValue("e2e-cv");
        expect(await fileText(page, "Other CV.enginecv.json")).toBe("precious");
        expect(await fileText(page, FILE)).not.toBeNull();
    });

    test("the link survives a reload", async ({ page }) => {
        await createBlankResume(page);
        await page.getByTestId("sidebar-basics-card").click();
        await page.getByTestId("basics-name-input").fill("Amina Hodzic");
        await linkNewFile(page);
        await expect.poll(async () => JSON.parse((await fileText(page)) ?? "{}").basics?.name).toBe("Amina Hodzic");

        await page.reload();
        await page.addStyleTag({ content: "nextjs-portal { display: none; }" });
        await expect(page.getByTestId("linked-file-trigger")).toContainText(FILE, { timeout: 10_000 });
        await outsideWrite(page, doc({ projects: [{ name: "After reload" }] }));
        await expect(page.locator(".resume-page").first()).toContainText("After reload", { timeout: 5000 });
    });

    test("makes no network request while linking and syncing", async ({ page }) => {
        const external: string[] = [];
        page.on("request", (request) => {
            const url = new URL(request.url());
            if (url.hostname !== "localhost" && !url.protocol.startsWith("data") && !url.protocol.startsWith("blob")) external.push(request.url());
        });
        await createBlankResume(page);
        const baseline = external.length;
        await linkNewFile(page);
        await outsideWrite(page, doc({ projects: [{ name: "Offline" }] }));
        await expect(page.locator(".resume-page").first()).toContainText("Offline", { timeout: 5000 });
        expect(external.slice(baseline)).toEqual([]);
    });

    test("the link control and the agent help have no serious accessibility violations", async ({ page }) => {
        await createBlankResume(page);
        await linkNewFile(page);
        await showPanel(page);
        await page.getByTestId("linked-file-agent-help-toggle").click();
        await expect(page.getByTestId("agent-help")).toBeVisible();
        await expectNoA11yViolations(page, { include: ['[data-testid="linked-file-panel"]'], label: "linked-file-panel" });
    });

    test.afterEach(async ({ page }) => {
        await clearOpfs(page).catch(() => undefined);
    });
});
