import { expect, type Page } from "@playwright/test";

// Helpers for the workspace folder specs. The OS folder picker cannot be driven, so `showDirectoryPicker`
// hands out a real directory handle from the browser's origin-private file system. A test plays the part of
// an outside program or an AI agent by writing files in it.

export const FOLDER = "applications";

export async function installPicker(page: Page) {
    await page.addInitScript((folder) => {
        (window as unknown as Record<string, unknown>).showDirectoryPicker = async () => {
            const root = await navigator.storage.getDirectory();
            return root.getDirectoryHandle(folder, { create: true });
        };
    }, FOLDER);
}

export async function readFile(page: Page, path: string): Promise<string | null> {
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
export async function writeFile(page: Page, path: string, text: string) {
    await page.evaluate(async ({ folder, file, content }) => {
        let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(folder, { create: true });
        const parts = file.split("/");
        for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
        const writable = await (await dir.getFileHandle(parts[parts.length - 1], { create: true })).createWritable();
        await writable.write(content);
        await writable.close();
    }, { folder: FOLDER, file: path, content: text });
}

export async function removeFile(page: Page, path: string) {
    await page.evaluate(async ({ folder, file }) => {
        let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(folder);
        const parts = file.split("/");
        for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
        await dir.removeEntry(parts[parts.length - 1]);
    }, { folder: FOLDER, file: path });
}

export async function renameFile(page: Page, from: string, to: string) {
    const text = await readFile(page, from);
    if (text === null) throw new Error(`no file ${from}`);
    await writeFile(page, to, text);
    await removeFile(page, from);
}

export async function listDir(page: Page, path: string): Promise<string[]> {
    return page.evaluate(async ({ folder, dirPath }) => {
        try {
            let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle(folder);
            for (const part of dirPath.split("/").filter(Boolean)) dir = await dir.getDirectoryHandle(part);
            const names: string[] = [];
            for await (const name of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) names.push(name);
            return names.sort();
        } catch {
            return [];
        }
    }, { folder: FOLDER, dirPath: path });
}

export async function clearOpfs(page: Page) {
    await page.evaluate(async () => {
        const root = await navigator.storage.getDirectory();
        for await (const name of (root as unknown as { keys(): AsyncIterable<string> }).keys()) await root.removeEntry(name, { recursive: true });
    });
}

/** Everything under the folder as "path -> text", for "nothing was touched" comparisons. */
export async function snapshotFolder(page: Page): Promise<Record<string, string>> {
    return page.evaluate(async (folder) => {
        const out: Record<string, string> = {};
        async function walk(dir: FileSystemDirectoryHandle, prefix: string) {
            for await (const [name, handle] of (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
                if (handle.kind === "directory") await walk(handle as FileSystemDirectoryHandle, `${prefix}${name}/`);
                else out[`${prefix}${name}`] = await (await (handle as FileSystemFileHandle).getFile()).text();
            }
        }
        try {
            await walk(await (await navigator.storage.getDirectory()).getDirectoryHandle(folder), "");
        } catch { /* no folder yet */ }
        return out;
    }, FOLDER);
}

/** The stored rows of one table, read straight from IndexedDB. */
export async function storedRows<T = Record<string, unknown>>(page: Page, table: string): Promise<T[]> {
    return page.evaluate(async (name) => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("EngineCVDatabase");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        if (!database.objectStoreNames.contains(name)) return [];
        return new Promise<unknown[]>((resolve, reject) => {
            const request = database.transaction(name, "readonly").objectStore(name).getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }, table) as Promise<T[]>;
}

export async function appHas(page: Page, text: string, table = "resumes"): Promise<boolean> {
    return JSON.stringify(await storedRows(page, table)).includes(text);
}

/** A blank CV with a title (its file name) and a person name, left on the dashboard. */
export async function createCv(page: Page, title: string, name: string) {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-new-resume").click();
    await page.getByTestId("create-resume-from-scratch").click();
    await expect(page).toHaveURL(/\/editor\/[^/]+$/);
    await page.addStyleTag({ content: "nextjs-portal { display: none; }" });
    const id = page.url().split("/").pop()!;
    // Wait for the editor to finish loading, or the load can overwrite what is typed.
    await expect(page.locator(".resume-page").first()).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("cv-title-input").fill(title);
    // Typing the next field within a few milliseconds of the title can lose it; a person never does.
    await page.waitForTimeout(1500);
    await page.getByTestId("sidebar-basics-card").click();
    await page.getByTestId("basics-name-input").fill(name);
    await expect.poll(async () => (await storedRows<{ id: string; basics: { name: string } }>(page, "resumes")).find((row) => row.id === id)?.basics.name, { timeout: 15_000 }).toBe(name);
    return id;
}

/** A letter written from a CV, left on the dashboard. */
export async function createLetter(page: Page, cvId: string) {
    await page.goto("/dashboard?tab=letters");
    await page.getByTestId("letter-new").click();
    await page.getByTestId(`letters-cv-option-${cvId}`).click();
    await page.getByTestId("letters-cv-create").click();
    await expect(page).toHaveURL(/\/letters\/[^/]+$/, { timeout: 30_000 });
    const id = page.url().split("/").pop()!;
    await page.getByTestId("letter-paragraph-input-0").fill("I would love to join the team.");
    await expect(page.getByTestId("letter-save-state")).toContainText(/Saved/);
    await page.goto("/dashboard");
    return id;
}

export async function openPanel(page: Page) {
    if (await page.getByTestId("workspace-panel").isVisible().catch(() => false)) return;
    await page.locator("[data-testid=dashboard-sidebar-workspace]:visible").first().click();
    await expect(page.getByTestId("workspace-panel")).toBeVisible();
}

export async function closePanel(page: Page) {
    if (await page.getByTestId("workspace-panel").isVisible().catch(() => false)) await page.getByTestId("workspace-close").click();
}

export async function connectFolder(page: Page, options: { hideContact?: boolean } = {}) {
    await page.goto("/dashboard");
    await openPanel(page);
    await page.getByTestId("workspace-choose").click();
    if (options.hideContact) await page.getByTestId("workspace-warning-hide").check();
    await page.getByTestId("workspace-warning-continue").click();
    await page.getByTestId("workspace-first-sync-apply").click();
    await expect(page.getByTestId("workspace-phase-connected")).toBeVisible();
    await closePanel(page);
}

/** Page errors and console errors seen so far; read at the end of a test. */
export function watchProblems(page: Page) {
    const problems: string[] = [];
    page.on("pageerror", (error) => {
        const stack = (error.stack ?? "").split(String.fromCharCode(10)).slice(1, 4).join(" | ");
        // @xenova/transformers (the in-browser summary model) throws this while loading in the dev server. It is
        // unrelated to the workspace, so it is left out of these checks.
        if (/isEmpty/.test(stack) && /Cannot convert undefined or null/.test(error.message)) return;
        problems.push(`pageerror: ${error.message} :: ${stack}`);
    });
    page.on("console", (message) => {
        if (message.type() !== "error") return;
        const text = message.text();
        // Dev-server noise that is not about the app's own behaviour.
        if (/favicon|Failed to load resource|DevTools|hydrat/i.test(text)) return;
        problems.push(`console: ${text}`);
    });
    return problems;
}

/** Requests that leave localhost, and requests whose body or address carries document text. */
export function watchNetwork(page: Page, needles: string[]) {
    const external: string[] = [];
    const leaks: string[] = [];
    page.on("request", (request) => {
        const url = request.url();
        if (!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(url) && !url.startsWith("data:") && !url.startsWith("blob:")) external.push(`${request.method()} ${url}`);
        const body = request.postData() ?? "";
        if (needles.some((needle) => body.includes(needle) || decodeURIComponent(url).includes(needle))) leaks.push(`${request.method()} ${url}`);
    });
    return { external, leaks };
}
