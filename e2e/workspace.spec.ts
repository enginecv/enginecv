import { expect, test, type Page } from "@playwright/test";

// Workspace folder (feature 091).
// The OS folder picker cannot be driven, so `showDirectoryPicker` hands out a real directory handle from the
// browser's origin-private file system: it behaves like a picked folder (read, atomic write, move, structured
// clone into IndexedDB) and a test plays the part of an outside program or an AI agent by writing files in it.

const FOLDER = "applications";

async function installPicker(page: Page) {
    await page.addInitScript((folder) => {
        (window as unknown as Record<string, unknown>).showDirectoryPicker = async () => {
            const root = await navigator.storage.getDirectory();
            return root.getDirectoryHandle(folder, { create: true });
        };
    }, FOLDER);
}

async function readFile(page: Page, path: string): Promise<string | null> {
    return page.evaluate(async ({ folder, file }) => {
        try {
            let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(folder);
            const parts = file.split("/");
            for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
            return await (await (await dir.getFileHandle(parts[parts.length - 1])).getFile()).text();
        } catch {
            return null;
        }
    }, { folder: FOLDER, file: path });
}

/** What an outside program or an agent does: write a whole file, creating folders on the way. */
async function outsideWrite(page: Page, path: string, text: string) {
    await page.evaluate(async ({ folder, file, content }) => {
        let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(folder, { create: true });
        const parts = file.split("/");
        for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
        const writable = await (await dir.getFileHandle(parts[parts.length - 1], { create: true })).createWritable();
        await writable.write(content);
        await writable.close();
    }, { folder: FOLDER, file: path, content: text });
}

async function listDir(page: Page, path: string): Promise<string[]> {
    return page.evaluate(async ({ folder, dirPath }) => {
        try {
            let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(folder);
            for (const part of dirPath.split("/").filter(Boolean)) dir = await dir.getDirectoryHandle(part);
            const names: string[] = [];
            for await (const name of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) names.push(name);
            return names;
        } catch {
            return [];
        }
    }, { folder: FOLDER, dirPath: path });
}

async function clearOpfs(page: Page) {
    await page.evaluate(async () => {
        const root = await navigator.storage.getDirectory();
        for await (const name of (root as unknown as { keys(): AsyncIterable<string> }).keys()) await root.removeEntry(name, { recursive: true });
    });
}

async function createNamedResume(page: Page, name: string) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-scratch").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    await page.addStyleTag({ content: "nextjs-portal { display: none; }" });
    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-name-input").fill(name);
    await page.goto("/dashboard");
}

/** True when a stored CV contains the text (the app followed the file). */
async function appHas(page: Page, text: string): Promise<boolean> {
    return page.evaluate(async (needle) => {
        const rows = await new Promise<unknown[]>((resolve) => {
            const open = indexedDB.open("EngineCVDatabase");
            open.onsuccess = () => {
                const all = open.result.transaction("resumes", "readonly").objectStore("resumes").getAll();
                all.onsuccess = () => resolve(all.result);
            };
            open.onerror = () => resolve([]);
        });
        return JSON.stringify(rows).includes(needle);
    }, text);
}

async function connectFolder(page: Page) {
    await page.getByTestId("dashboard-sidebar-workspace").click();
    await page.getByTestId("workspace-choose").click();
    await page.getByTestId("workspace-warning-continue").click();
    await page.getByTestId("workspace-first-sync-apply").click();
    await expect(page.getByTestId("workspace-phase-connected")).toBeVisible();
}

async function firstCvFile(page: Page): Promise<string> {
    await expect.poll(async () => (await listDir(page, "cvs")).length).toBeGreaterThan(0);
    return `cvs/${(await listDir(page, "cvs"))[0]}`;
}

test.beforeEach(async ({ page }) => {
    await installPicker(page);
    await page.goto("/dashboard");
    await clearOpfs(page);
});

test.describe("workspace folder", () => {
    test("sets up, follows an outside edit, explains a broken file, asks before dropping a section, answers an export request and disconnects", async ({ page }) => {
        await createNamedResume(page, "Amina Hodzic");
        await connectFolder(page);

        // The folder holds the CV and the files an agent needs.
        const cvPath = await firstCvFile(page);
        expect(await readFile(page, "AGENTS.md")).not.toBeNull();
        const original = JSON.parse((await readFile(page, cvPath))!) as Record<string, unknown>;
        expect((original.basics as Record<string, string>).name).toBe("Amina Hodzic");

        // An outside edit shows up in the app within seconds; the document's design is not part of the file and is kept.
        const edited = { ...original, projects: ["Weather Bot", "Chess Engine", "Recipe Box", "Tide Tracker"].map((name) => ({ name, description: "Side project" })) };
        await outsideWrite(page, cvPath, `${JSON.stringify(edited, null, 2)}\n`);
        await page.getByTestId("workspace-close").click();
        await expect.poll(() => appHas(page, "Weather Bot"), { timeout: 10_000 }).toBe(true);

        // A file that is not valid JSON changes nothing and says why.
        await outsideWrite(page, cvPath, "{ this is not json");
        await expect(page.getByTestId("doc-state-blocked").first()).toBeVisible({ timeout: 10_000 });
        // Fixing the file recovers.
        await outsideWrite(page, cvPath, `${JSON.stringify(edited, null, 2)}\n`);
        await expect(page.getByTestId("doc-state-blocked")).toHaveCount(0, { timeout: 10_000 });
        await expect.poll(() => appHas(page, "Weather Bot")).toBe(true);

        // A file that drops a whole section is held for review instead of applied.
        // (read the file again: once applied, the app writes its own version with ids)
        await expect.poll(async () => JSON.parse((await readFile(page, cvPath))!).projects?.length).toBe(4);
        const dropped = JSON.parse((await readFile(page, cvPath))!) as Record<string, unknown>;
        delete dropped.projects;
        await outsideWrite(page, cvPath, `${JSON.stringify(dropped, null, 2)}\n`);
        await expect(page.getByTestId("doc-state-review").first()).toBeVisible({ timeout: 10_000 });

        // An agent asks for an export and gets an answer and a file.
        await outsideWrite(page, ".enginecv/requests/e2e-export.request.json", JSON.stringify({ id: "e2e-export", action: "export", target: cvPath, format: "json" }));
        await expect.poll(async () => readFile(page, ".enginecv/results/e2e-export.result.json"), { timeout: 15_000 }).not.toBeNull();
        const result = JSON.parse((await readFile(page, ".enginecv/results/e2e-export.result.json"))!) as { ok: boolean };
        expect(result.ok).toBe(true);
        expect((await listDir(page, "exports")).length).toBeGreaterThan(0);

        // Disconnecting leaves the files and the documents.
        await page.getByTestId("dashboard-sidebar-workspace").click();
        await page.getByTestId("workspace-disconnect").click();
        await page.getByRole("button", { name: /disconnect/i }).last().click();
        await expect(page.getByTestId("workspace-choose")).toBeVisible();
        expect(await readFile(page, cvPath)).not.toBeNull();
        await page.getByTestId("workspace-close").click();
        await expect(page.getByTestId("dashboard-resume-card").first()).toBeVisible();
    });

    test("works offline and no request carries document content", async ({ page, context }) => {
        const outbound: string[] = [];
        page.on("request", (request) => {
            const body = request.postData();
            if (body && /Amina Hodzic|Weather Bot/.test(body)) outbound.push(`${request.method()} ${request.url()}`);
            if (/Amina%20Hodzic|Amina\+Hodzic|Weather%20Bot/.test(request.url())) outbound.push(`${request.method()} ${request.url()}`);
        });

        await createNamedResume(page, "Amina Hodzic");
        await context.setOffline(true);
        await connectFolder(page);

        const cvPath = await firstCvFile(page);
        const doc = JSON.parse((await readFile(page, cvPath))!) as Record<string, unknown>;
        await outsideWrite(page, cvPath, `${JSON.stringify({ ...doc, projects: [{ name: "Weather Bot", description: "Offline" }] }, null, 2)}\n`);
        await expect.poll(async () => readFile(page, cvPath)).toContain("Weather Bot");
        await page.getByTestId("workspace-close").click();
        await expect.poll(() => appHas(page, "Weather Bot"), { timeout: 10_000 }).toBe(true);

        expect(outbound).toEqual([]);
    });

    for (const width of [1024, 390]) {
        test(`the panel and its dialogs do not overflow at ${width}px wide`, async ({ page }) => {
            await page.setViewportSize({ width, height: 800 });
            await createNamedResume(page, "Amina Hodzic");
            // On a phone the sidebar sits behind its trigger.
            if (width < 768) await page.getByRole("button", { name: /toggle sidebar/i }).first().click();
            await page.locator("[data-testid=dashboard-sidebar-workspace]:visible").first().click();
            await page.getByTestId("workspace-choose").click();
            const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
            expect(await fits()).toBe(true);
            await page.getByTestId("workspace-warning-continue").click();
            await expect(page.getByTestId("workspace-first-sync")).toBeVisible();
            expect(await fits()).toBe(true);
            await page.getByTestId("workspace-first-sync-apply").click();
            await expect(page.getByTestId("workspace-phase-connected")).toBeVisible();
            expect(await fits()).toBe(true);
        });
    }
});
