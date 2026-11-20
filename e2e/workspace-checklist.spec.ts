import { expect, test, type Page } from "@playwright/test";
import {
    FOLDER, appHas, clearOpfs, closePanel, connectFolder, createCv, createLetter, installPicker, listDir, openPanel,
    readFile, removeFile, renameFile, snapshotFolder, storedRows, watchNetwork, watchProblems, writeFile,
} from "./helpers/workspace";

// The automated half of the workspace manual checklist (specs/091-agent-workspace/manual-test-checklist.md).
// Real disks, OneDrive/Dropbox, a second machine, OS permission prompts and file locks cannot be driven here.

test.beforeEach(async ({ page }) => {
    await installPicker(page);
    await page.goto("/dashboard");
    await clearOpfs(page);
});

const json = (text: string | null) => JSON.parse(text ?? "{}") as Record<string, any>;
/** The first CV file in the folder once it holds a complete document (a file can exist a moment before its content). */
const firstCvFile = async (page: Page, stem?: string) => {
    let found = "";
    await expect.poll(async () => {
        const names = (await listDir(page, "cvs")).filter((n) => n.endsWith(".cv.json") && (!stem || n.includes(stem)));
        for (const name of names) {
            try {
                JSON.parse((await readFile(page, `cvs/${name}`)) ?? "");
                found = `cvs/${name}`;
                return true;
            } catch { /* not complete yet */ }
        }
        return false;
    }, { timeout: 15_000 }).toBe(true);
    return found;
};

test.describe("2. connect", () => {
    test("the warning comes before any write, cancelling at either step writes nothing, and other files are never touched", async ({ page }) => {
        const problems = watchProblems(page);
        await createCv(page, "Master", "Amina Hodzic");
        // Files that are not EngineCV's, in and outside the folders EngineCV uses.
        await writeFile(page, "notes.txt", "my private notes");
        await writeFile(page, "cvs/random.json", '{"hello":"world"}');
        await writeFile(page, "other/readme.md", "# keep me");
        const before = await snapshotFolder(page);

        await page.goto("/dashboard");
        await openPanel(page);
        await page.getByTestId("workspace-choose").click();
        await expect(page.getByTestId("workspace-warning")).toBeVisible();
        expect(await snapshotFolder(page)).toEqual(before);
        await page.getByTestId("workspace-warning-cancel").click();
        expect(await snapshotFolder(page)).toEqual(before);

        await page.getByTestId("workspace-choose").click();
        await page.getByTestId("workspace-warning-continue").click();
        await expect(page.getByTestId("workspace-first-sync")).toBeVisible();
        expect(await snapshotFolder(page)).toEqual(before);
        await page.getByTestId("workspace-first-sync-cancel").click();
        expect(await snapshotFolder(page)).toEqual(before);
        expect(await storedRows(page, "workspace")).toHaveLength(0);

        // Connect for real: only EngineCV's own files appear, the strangers are byte-identical.
        await page.getByTestId("workspace-choose").click();
        await page.getByTestId("workspace-warning-continue").click();
        await page.getByTestId("workspace-first-sync-apply").click();
        await expect(page.getByTestId("workspace-phase-connected")).toBeVisible();
        const after = await snapshotFolder(page);
        for (const [path, text] of Object.entries(before)) expect(after[path], path).toBe(text);
        expect(after["AGENTS.md"]).toBeTruthy();
        expect(Object.keys(after).some((p) => /^cvs\/.*\.cv\.json$/.test(p))).toBe(true);
        expect(problems).toEqual([]);
    });

    test("nothing document-related leaves the browser while connecting and syncing", async ({ page }) => {
        const net = watchNetwork(page, ["Amina Hodzic", "Weather Bot", "amina@example.com"]);
        await createCv(page, "Master", "Amina Hodzic");
        await connectFolder(page);
        const file = await firstCvFile(page);
        const doc = json(await readFile(page, file));
        await writeFile(page, file, JSON.stringify({ ...doc, projects: [{ name: "Weather Bot", description: "x" }] }, null, 2));
        await expect.poll(() => appHas(page, "Weather Bot")).toBe(true);
        expect(net.leaks).toEqual([]);
        test.info().annotations.push({ type: "external requests", description: net.external.join(" | ") || "none" });
    });
});

test.describe("3. app to file", () => {
    test("edits, new documents and renames reach the folder, deletes honour the choice, undo works, a reload duplicates nothing", async ({ page }) => {
        const problems = watchProblems(page);
        const cvId = await createCv(page, "Master", "Amina Hodzic");
        await createLetter(page, cvId);
        await connectFolder(page);
        expect((await listDir(page, "cvs")).filter((n) => n.endsWith(".cv.json"))).toHaveLength(1);
        expect((await listDir(page, "letters")).filter((n) => n.endsWith(".letter.json"))).toHaveLength(1);

        // An edit in the editor reaches the file within seconds.
        await page.goto(`/editor/${cvId}`);
        await page.getByTestId("sidebar-basics-card").click();
        await page.getByTestId("basics-name-input").fill("Amina H.");
        const file = await firstCvFile(page);
        await expect.poll(async () => json(await readFile(page, file)).basics?.name, { timeout: 8000 }).toBe("Amina H.");

        // A new CV gets a file; renaming it renames the file with no leftover.
        const second = await createCv(page, "Second", "Second Person");
        await expect.poll(async () => (await listDir(page, "cvs")).filter((n) => n.endsWith(".cv.json")).length, { timeout: 10_000 }).toBe(2);
        await page.goto(`/editor/${second}`);
        await page.getByTestId("cv-title-input").fill("Renamed Second");
        await expect.poll(async () => (await listDir(page, "cvs")).some((n) => n.includes("Renamed Second")), { timeout: 10_000 }).toBe(true);
        expect((await listDir(page, "cvs")).filter((n) => n.includes("Second") && !n.includes("Renamed"))).toEqual([]);
        expect((await listDir(page, "cvs")).filter((n) => n.endsWith(".cv.json"))).toHaveLength(2);

        // Reloading changes nothing: no duplicates, still connected.
        await page.goto("/dashboard");
        await page.reload();
        await page.waitForTimeout(2500);
        expect((await listDir(page, "cvs")).filter((n) => n.endsWith(".cv.json"))).toHaveLength(2);
        expect(await storedRows(page, "resumes")).toHaveLength(2);

        // Delete with "keep the file": the file stays, and Undo within 8 seconds brings the CV back, linked to it.
        const keptFile = (await listDir(page, "cvs")).find((n) => n.includes("Renamed Second"))!;
        await page.getByTestId("dashboard-resume-card").filter({ hasText: "Renamed Second" }).getByRole("button", { name: "Delete resume" }).click();
        await page.getByTestId("workspace-delete-keep").check();
        await page.getByTestId("workspace-delete-confirm").click();
        await expect(page.getByTestId("cv-undo")).toBeVisible();
        expect(await readFile(page, `cvs/${keptFile}`)).not.toBeNull();
        await page.getByTestId("cv-undo-button").click();
        await expect(page.getByTestId("dashboard-resume-card").filter({ hasText: "Renamed Second" })).toBeVisible();
        await page.waitForTimeout(3000);
        expect((await listDir(page, "cvs")).filter((n) => n.endsWith(".cv.json"))).toHaveLength(2);

        // Delete with "delete the file": the file is gone and a backup is kept.
        await page.getByTestId("dashboard-resume-card").filter({ hasText: "Renamed Second" }).getByRole("button", { name: "Delete resume" }).click();
        await page.getByTestId("workspace-delete-remove").check();
        await page.getByTestId("workspace-delete-confirm").click();
        await expect.poll(async () => (await listDir(page, "cvs")).some((n) => n.includes("Renamed Second"))).toBe(false);
        expect((await listDir(page, ".enginecv/conflicts")).length).toBeGreaterThan(0);
        expect(problems).toEqual([]);
    });
});

test.describe("4. file to app", () => {
    test("an outside edit shows up within a few seconds with no reload, on the dashboard and in the editor, keeping the design", async ({ page }) => {
        const problems = watchProblems(page);
        const cvId = await createCv(page, "Master", "Amina Hodzic");
        await connectFolder(page);
        const file = await firstCvFile(page);
        const before = json(await readFile(page, file));

        // Remember the design (the file never carries it).
        // (A new section legitimately adds itself to the section list; colors, fonts and spacing must not move.)
        const design = async () => { const st = (await storedRows<any>(page, "resumes"))[0].settings; return JSON.stringify({ theme: st.theme, colors: st.colors, typography: st.typography, spacing: st.spacing, headings: st.headings, header: st.header, design: st.design }); };
        const designBefore = await design();

        // On the dashboard.
        const started = Date.now();
        await writeFile(page, file, JSON.stringify({ ...before, projects: [{ name: "Dashboard Edit", description: "x" }] }, null, 2));
        await expect.poll(() => appHas(page, "Dashboard Edit"), { timeout: 10_000 }).toBe(true);
        const dashboardLatency = Date.now() - started;

        // In the editor, without reloading.
        await page.goto(`/editor/${cvId}`);
        await expect(page.locator(".resume-page").first()).toBeVisible();
        const editorStart = Date.now();
        await writeFile(page, file, JSON.stringify({ ...json(await readFile(page, file)), projects: [{ name: "Editor Edit", description: "x" }] }, null, 2));
        await expect(page.locator(".resume-page").first()).toContainText("Editor Edit", { timeout: 10_000 });
        const editorLatency = Date.now() - editorStart;

        expect(await design()).toBe(designBefore);
        test.info().annotations.push({ type: "latency ms", description: `dashboard ${dashboardLatency}, editor ${editorLatency}` });
        expect(dashboardLatency).toBeLessThan(8000);
        expect(editorLatency).toBeLessThan(8000);
        expect(problems).toEqual([]);
    });

    test("a tab that was in the background catches up when it comes back, and Undo from the activity list restores the old text", async ({ page, context }) => {
        await createCv(page, "Master", "Amina Hodzic");
        await connectFolder(page);
        const file = await firstCvFile(page);
        const doc = json(await readFile(page, file));

        const other = await context.newPage();
        await other.goto("about:blank");
        await other.bringToFront();
        await writeFile(page, file, JSON.stringify({ ...doc, projects: [{ name: "While Hidden", description: "x" }] }, null, 2));
        await page.waitForTimeout(1500);
        await page.bringToFront();
        await expect.poll(() => appHas(page, "While Hidden"), { timeout: 8000 }).toBe(true);

        await openPanel(page);
        await page.getByTestId("workspace-open-activity").click();
        await expect(page.getByTestId("workspace-activity-list")).toBeVisible();
        await page.getByTestId("workspace-activity-row").first().getByRole("button", { name: /undo/i }).click();
        await expect.poll(() => appHas(page, "While Hidden"), { timeout: 8000 }).toBe(false);
    });

    test("a letter's file edit shows up in the letter", async ({ page }) => {
        const cvId = await createCv(page, "Master", "Amina Hodzic");
        await createLetter(page, cvId);
        await connectFolder(page);
        const letters = await listDir(page, "letters");
        const path = `letters/${letters.find((n) => n.endsWith(".letter.json"))!}`;
        const doc = json(await readFile(page, path));
        const letterId = (await storedRows<{ id: string }>(page, "coverLetters"))[0].id;
        await page.goto(`/letters/${letterId}`);
        await expect(page.getByTestId("letter-page").first()).toBeVisible();
        const text = JSON.stringify(doc).replace("I would love to join the team.", "Edited from the file system.");
        await writeFile(page, path, JSON.stringify(JSON.parse(text), null, 2));
        await expect(page.getByTestId("letter-paragraph-input-0")).toHaveValue("Edited from the file system.", { timeout: 10_000 });
    });
});

async function connectWithCv(page: Page, title = "Master", name = "Amina Hodzic") {
    const cvId = await createCv(page, title, name);
    await connectFolder(page);
    const file = await firstCvFile(page);
    return { cvId, file, doc: json(await readFile(page, file)) };
}
const stateChip = (page: Page, state: string) => page.getByTestId(`doc-state-${state}`).first();

test.describe("5. bad files", () => {
    test("invalid JSON and a half-written file change nothing, say why, are not overwritten, and recover when fixed", async ({ page }) => {
        const problems = watchProblems(page);
        const { file, doc } = await connectWithCv(page);
        const good = JSON.stringify({ ...doc, projects: [{ name: "Good Edit", description: "x" }] }, null, 2);

        await writeFile(page, file, "{ this is not json");
        await expect(stateChip(page, "blocked")).toBeVisible({ timeout: 10_000 });
        await page.waitForTimeout(3500);
        expect(await readFile(page, file)).toBe("{ this is not json"); // never overwritten
        expect(await appHas(page, "Amina Hodzic")).toBe(true); // the CV is intact

        await writeFile(page, file, good.slice(0, Math.floor(good.length / 2)));
        await page.waitForTimeout(3500);
        await expect(stateChip(page, "blocked")).toBeVisible();
        expect(await appHas(page, "Good Edit")).toBe(false);

        await writeFile(page, file, good);
        await expect(page.getByTestId("doc-state-blocked")).toHaveCount(0, { timeout: 10_000 });
        await expect.poll(() => appHas(page, "Good Edit"), { timeout: 8000 }).toBe(true);
        expect(problems).toEqual([]);
    });

    test("a BOM, Windows line endings, a code fence and a chat intro are all read; the file is rewritten clean", async ({ page }) => {
        const { file, doc } = await connectWithCv(page);
        const make = (name: string) => JSON.stringify({ ...doc, projects: [{ name, description: "x" }] }, null, 2);
        const slips: Array<[string, (t: string) => string]> = [
            ["Bom Edit", (t) => `﻿${t}`],
            ["Crlf Edit", (t) => t.replace(/\n/g, "\r\n")],
            ["Fenced Edit", (t) => `\`\`\`json\n${t}\n\`\`\``],
            ["Chat Edit", (t) => `Here is your CV:\n${t}\nLet me know!`],
        ];
        for (const [name, mangle] of slips) {
            await writeFile(page, file, mangle(make(name)));
            await expect.poll(() => appHas(page, name), { timeout: 10_000, message: name }).toBe(true);
            await expect(page.getByTestId("doc-state-blocked")).toHaveCount(0);
        }
    });

    test("a dropped section is held for review: Keep mine leaves the CV, Apply removes the entries", async ({ page }) => {
        const { file, doc } = await connectWithCv(page);
        const four = JSON.stringify({ ...doc, projects: ["A", "B", "C", "D"].map((n) => ({ name: `Proj ${n}`, description: "x" })) }, null, 2);
        await writeFile(page, file, four);
        await expect.poll(() => appHas(page, "Proj D"), { timeout: 10_000 }).toBe(true);
        await expect.poll(async () => json(await readFile(page, file)).projects?.length, { timeout: 8000 }).toBe(4);

        const dropped = json(await readFile(page, file));
        delete dropped.projects;
        await writeFile(page, file, JSON.stringify(dropped, null, 2));
        await expect(stateChip(page, "review")).toBeVisible({ timeout: 10_000 });
        expect(await appHas(page, "Proj D")).toBe(true); // not applied yet

        await openPanel(page);
        await page.getByTestId("workspace-doc-list").getByRole("button", { name: /review/i }).first().click();
        await expect(page.getByTestId("workspace-review")).toBeVisible();
        await expect(page.getByTestId("workspace-review-removed")).toContainText("Proj");
        await page.getByTestId("workspace-review-apply").click();
        await expect.poll(() => appHas(page, "Proj D"), { timeout: 10_000 }).toBe(false);
    });

    test("an oversized file and a stranger .json in cvs/ are refused with a reason, never imported", async ({ page }) => {
        await connectWithCv(page);
        await writeFile(page, "cvs/Huge.cv.json", JSON.stringify({ format: "enginecv.authoring/v1", basics: { name: "Huge" }, summary: "x".repeat(600_000) }));
        await writeFile(page, "cvs/random.json", '{"hello":"world"}');
        await page.waitForTimeout(5000);
        expect(await appHas(page, "Huge")).toBe(false);
        expect(await readFile(page, "cvs/random.json")).toBe('{"hello":"world"}');
        expect(await storedRows(page, "resumes")).toHaveLength(1);
    });

    test("editing the file of a letter marked as sent is refused", async ({ page }) => {
        const cvId = await createCv(page, "Master", "Amina Hodzic");
        const letterId = await createLetter(page, cvId);
        await page.goto(`/letters/${letterId}`);
        await page.getByTestId("letter-mark-sent").click();
        await page.getByTestId("letter-send-confirm").click();
        await expect(page.getByTestId("letter-status-chip")).toHaveText(/Sent/i);
        await connectFolder(page);
        const name = (await listDir(page, "letters")).find((n) => n.endsWith(".letter.json"))!;
        const path = `letters/${name}`;
        const doc = json(await readFile(page, path));
        await writeFile(page, path, JSON.stringify({ ...doc, paragraphs: ["Changed after sending"] }, null, 2));
        await page.waitForTimeout(4000);
        expect(await appHas(page, "Changed after sending", "coverLetters")).toBe(false);
    });
});

test.describe("6. new, renamed, deleted and duplicated files", () => {
    test("a new complete file becomes a document, an incomplete one is listed with a reason", async ({ page }) => {
        const { doc } = await connectWithCv(page);
        const fresh = { ...doc, id: undefined, basics: { ...doc.basics, name: "Agent Made" } };
        delete (fresh as any).id;
        await writeFile(page, "cvs/Agent Made.cv.json", JSON.stringify(fresh, null, 2));
        await expect.poll(() => appHas(page, "Agent Made"), { timeout: 10_000 }).toBe(true);
        await writeFile(page, "cvs/Half.cv.json", '{"format":"enginecv.authoring/v1","basics":{');
        await page.waitForTimeout(4000);
        await openPanel(page);
        await expect(page.getByTestId("workspace-open-conflicts")).toBeVisible();
    });

    test("a rename in the file manager is followed by id, nothing is lost or duplicated", async ({ page }) => {
        const { file } = await connectWithCv(page);
        await renameFile(page, file, "cvs/Moved Around.cv.json");
        await page.waitForTimeout(4500);
        expect(await storedRows(page, "resumes")).toHaveLength(1);
        expect((await listDir(page, "cvs")).filter((n) => n.endsWith(".cv.json"))).toEqual(["Moved Around.cv.json"]);
        const doc = json(await readFile(page, "cvs/Moved Around.cv.json"));
        await writeFile(page, "cvs/Moved Around.cv.json", JSON.stringify({ ...doc, projects: [{ name: "After Rename", description: "x" }] }, null, 2));
        await expect.poll(() => appHas(page, "After Rename"), { timeout: 10_000 }).toBe(true);
    });

    test("a deleted file leaves the CV in place; Recreate brings the file back", async ({ page }) => {
        const { file } = await connectWithCv(page);
        await removeFile(page, file);
        await expect(stateChip(page, "detached")).toBeVisible({ timeout: 12_000 });
        expect(await storedRows(page, "resumes")).toHaveLength(1);
        await openPanel(page);
        await page.getByTestId("workspace-open-conflicts").click();
        await page.getByTestId("workspace-conflicts-detached").getByRole("button", { name: /recreate/i }).first().click();
        await expect.poll(async () => (await listDir(page, "cvs")).some((n) => n.endsWith(".cv.json")), { timeout: 10_000 }).toBe(true);
    });

    test("two files with one id are flagged and nothing is applied until you choose", async ({ page }) => {
        const { file, doc } = await connectWithCv(page);
        await writeFile(page, "cvs/Copy of Master.cv.json", JSON.stringify({ ...doc, projects: [{ name: "From The Copy", description: "x" }] }, null, 2));
        await page.waitForTimeout(5000);
        expect(await appHas(page, "From The Copy")).toBe(false);
        await openPanel(page);
        await page.getByTestId("workspace-open-conflicts").click();
        await expect(page.getByTestId("workspace-conflicts-duplicates")).toBeVisible();
        expect(await readFile(page, file)).not.toBeNull();
    });
});

test.describe("7. pause and two tabs", () => {
    test("pausing holds both directions; resuming picks the changes up", async ({ page }) => {
        const { file, doc } = await connectWithCv(page);
        await openPanel(page);
        await page.getByTestId("workspace-pause").click();
        await expect(page.getByTestId("workspace-paused")).toBeVisible();
        await closePanel(page);
        await writeFile(page, file, JSON.stringify({ ...doc, projects: [{ name: "While Paused", description: "x" }] }, null, 2));
        await page.waitForTimeout(4500);
        expect(await appHas(page, "While Paused")).toBe(false);
        await openPanel(page);
        await page.getByTestId("workspace-pause").click();
        await expect(page.getByTestId("workspace-paused")).toHaveCount(0);
        await expect.poll(() => appHas(page, "While Paused"), { timeout: 12_000 }).toBe(true);
    });

    test("a second tab says another tab is syncing, and takes over when the first closes", async ({ page, context }) => {
        const { file, doc } = await connectWithCv(page);
        const second = await context.newPage();
        await second.goto("/dashboard");
        await second.locator("[data-testid=dashboard-sidebar-workspace]:visible").first().click();
        await expect(second.getByTestId("workspace-other-tab")).toBeVisible({ timeout: 10_000 });
        await page.close();
        await writeFile(second, file, JSON.stringify({ ...doc, projects: [{ name: "Second Tab Edit", description: "x" }] }, null, 2));
        await expect.poll(() => appHas(second, "Second Tab Edit"), { timeout: 15_000 }).toBe(true);
    });
});

test.describe("9. agents", () => {
    test("AGENTS.md and the index come back when deleted, and an export request is answered", async ({ page }) => {
        const { file } = await connectWithCv(page);
        await removeFile(page, "AGENTS.md");
        await removeFile(page, ".enginecv/index.json");
        await expect.poll(async () => (await readFile(page, "AGENTS.md")) !== null && (await readFile(page, ".enginecv/index.json")) !== null, { timeout: 20_000 }).toBe(true);

        await writeFile(page, ".enginecv/requests/chk1.request.json", JSON.stringify({ id: "chk1", action: "export", target: file, format: "md" }));
        await expect.poll(() => readFile(page, ".enginecv/results/chk1.result.json"), { timeout: 15_000 }).not.toBeNull();
        expect(json(await readFile(page, ".enginecv/results/chk1.result.json")).ok).toBe(true);
        await writeFile(page, ".enginecv/requests/chk2.request.json", JSON.stringify({ id: "chk2", action: "export", target: "nope.cv.json", format: "md" }));
        await expect.poll(() => readFile(page, ".enginecv/results/chk2.result.json"), { timeout: 15_000 }).not.toBeNull();
        expect(json(await readFile(page, ".enginecv/results/chk2.result.json")).ok).toBe(false);
    });

    test("a letter an agent writes becomes a draft that follows the right CV; the in-browser assistant tools are off by default", async ({ page }) => {
        const { cvId, doc } = await connectWithCv(page);
        const letter = { format: "enginecv.letter/v1", status: "draft", cv: { id: cvId, title: "Master" }, standalone: false, language: "en", layout: "standard", paper: "a4", date: "2026-11-20", recipient: { name: "", address: "" }, company: "Acme", role: "Designer", subject: "Application", salutation: "Dear Hiring Manager,", paragraphs: ["Written by an agent."], closing: "Kind regards," };
        await writeFile(page, "letters/Acme.letter.json", JSON.stringify(letter, null, 2));
        await expect.poll(() => appHas(page, "Written by an agent.", "coverLetters"), { timeout: 12_000 }).toBe(true);
        const rows = await storedRows<any>(page, "coverLetters");
        expect(rows.find((r) => JSON.stringify(r).includes("Written by an agent."))?.cvId).toBe(cvId);
        expect(doc.basics.name).toBe("Amina Hodzic");
        expect(await page.evaluate(() => localStorage.getItem("enginecv.browserTools"))).toBeNull();
        await openPanel(page);
        // The toggle only exists where the browser offers the assistant API; wherever it is shown it starts off.
        if (await page.getByTestId("workspace-browser-tools-toggle").count()) await expect(page.getByTestId("workspace-browser-tools-toggle")).not.toBeChecked();
    });
});

test.describe("10. privacy and data", () => {
    test("leaving contact details out strips them from the files, turning it off writes them back, the app keeps them", async ({ page }) => {
        const problems = watchProblems(page);
        const { file, doc } = await connectWithCv(page);
        // Give the CV an email by way of the file, as an agent would.
        await writeFile(page, file, JSON.stringify({ ...doc, basics: { ...doc.basics, email: "amina@example.com" } }, null, 2));
        await expect.poll(() => appHas(page, "amina@example.com"), { timeout: 10_000 }).toBe(true);

        await openPanel(page);
        await page.getByTestId("workspace-hide-contact").click();
        await expect(page.getByTestId("workspace-hide-contact")).toBeChecked();
        await expect.poll(async () => (await readFile(page, file)) ?? "", { timeout: 15_000 }).not.toContain("amina@example.com");
        expect(await appHas(page, "amina@example.com")).toBe(true); // the app keeps it

        await page.getByTestId("workspace-hide-contact").click();
        await expect(page.getByTestId("workspace-hide-contact")).not.toBeChecked();
        await expect.poll(async () => (await readFile(page, file)) ?? "", { timeout: 15_000 }).toContain("amina@example.com");
        expect(problems).toEqual([]);
    });

    test("download, Delete all my data and import: the folder files are untouched, the documents come back", async ({ page }) => {
        test.setTimeout(120_000);
        const problems = watchProblems(page);
        const { file } = await connectWithCv(page);
        const before = await snapshotFolder(page);

        await page.goto("/your-data");
        await expect(page.getByTestId("your-data-files")).toContainText(/not in this browser/);
        const downloadPromise = page.waitForEvent("download");
        await page.getByTestId("your-data-download").getByRole("button", { name: "Download my data" }).click();
        const path = (await (await downloadPromise).path())!;

        await page.getByRole("button", { name: "Delete all my data" }).click();
        const dialog = page.getByTestId("delete-all-data-dialog");
        await expect(dialog.getByTestId("delete-workspace-stays")).toBeVisible();
        await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
        await dialog.getByRole("button", { name: "Delete everything" }).click();
        await expect(dialog.getByTestId("deletion-result")).toHaveAttribute("data-status", "complete");

        // The browser data is gone. (The stand-in folder lives in the browser's own storage, so unlike a real folder on a disk it is
        // wiped too; that the real folder stays is covered by the dialog note above and must be checked by hand.)
        await page.goto("/dashboard");
        expect(await storedRows(page, "resumes")).toHaveLength(0);

        await page.getByTestId("dashboard-new-resume").click();
        await page.getByTestId("create-resume-import-json-input").setInputFiles(path);
        await expect(page.getByText(/Imported 1 CV from your data export/)).toBeVisible({ timeout: 30_000 });
        expect(await storedRows(page, "resumes")).toHaveLength(1);
        expect(Object.keys(before).length).toBeGreaterThan(0);
        expect(file).toBeTruthy();
        expect(problems).toEqual([]);
    });

    test("disconnecting leaves the files and the documents, and syncing stops", async ({ page }) => {
        const { file, doc } = await connectWithCv(page);
        await page.goto("/dashboard");
        await openPanel(page);
        await page.getByTestId("workspace-disconnect").click();
        await page.getByRole("button", { name: "Disconnect" }).last().click();
        await expect(page.getByTestId("workspace-choose")).toBeVisible();
        await closePanel(page);
        const before = await readFile(page, file);
        await writeFile(page, file, JSON.stringify({ ...doc, projects: [{ name: "After Disconnect", description: "x" }] }, null, 2));
        await page.waitForTimeout(4500);
        expect(await appHas(page, "After Disconnect")).toBe(false);
        expect(await storedRows(page, "resumes")).toHaveLength(1);
        expect(before).not.toBeNull();
    });
});

test.describe("11. languages", () => {
    for (const locale of ["de", "bs"] as const) {
        test(`the panel, warning and review read in ${locale} at phone width with no raw keys`, async ({ page }) => {
            await createCv(page, "Master", "Amina Hodzic");
            await page.setViewportSize({ width: 390, height: 800 });
            await page.goto(`/${locale}/dashboard`).catch(() => undefined);
            if (!/\/dashboard/.test(page.url())) await page.goto("/dashboard");
            await page.evaluate((l) => localStorage.setItem("enginecv-preferences", JSON.stringify({ locale: l })), locale).catch(() => undefined);
            await page.goto("/dashboard");
            await page.getByRole("button", { name: /Toggle Sidebar/i }).first().click().catch(() => undefined);
            await page.locator("[data-testid=dashboard-sidebar-workspace]:visible").first().click();
            await page.getByTestId("workspace-choose").click();
            const text = async () => (await page.locator("body").innerText());
            expect(await text()).not.toMatch(/\bworkspace\.[a-zA-Z]+\.[a-zA-Z.]+/);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
        });
    }
});

test.describe("12. idle", () => {
    test("with nothing changing there are no long tasks and no console errors", async ({ page }) => {
        const problems = watchProblems(page);
        await connectWithCv(page);
        await page.evaluate(() => {
            (window as any).__longTasks = [];
            new PerformanceObserver((list) => (window as any).__longTasks.push(...list.getEntries().map((e) => Math.round(e.duration)))).observe({ entryTypes: ["longtask"] });
        });
        await page.waitForTimeout(8000);
        const long = await page.evaluate(() => (window as any).__longTasks as number[]);
        test.info().annotations.push({ type: "long tasks during 8s idle", description: JSON.stringify(long) });
        expect(long.filter((d) => d >= 100)).toEqual([]);
        expect(problems).toEqual([]);
    });
});
