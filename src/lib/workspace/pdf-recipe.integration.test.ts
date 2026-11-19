import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { exportsReference } from "./agent-files";

/**
 * The PDF recipe in `exports.md` must actually work. This renders a small self-contained HTML file to a
 * PDF with the exact flags the recipe gives, and checks one A4 page with text a machine can read. It
 * runs only where a Chrome or Edge is named in CHROME_PATH (it is not part of the normal suite).
 */
const chrome = process.env.CHROME_PATH;

/** Waits until the file exists and its size has not changed for 1 second. */
async function waitUntilStable(path: string, timeoutMs = 30_000): Promise<void> {
    const started = Date.now();
    let last = -1;
    let since = Date.now();
    while (Date.now() - started < timeoutMs) {
        const size = existsSync(path) ? statSync(path).size : -1;
        if (size !== last) {
            last = size;
            since = Date.now();
        } else if (size > 0 && Date.now() - since >= 1000) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
}
const run = chrome && existsSync(chrome) ? describe : describe.skip;

run("PDF recipe (needs CHROME_PATH)", () => {
    it("gives the flags the test uses", () => {
        const text = exportsReference();
        for (const flag of ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=5000", "--print-to-pdf="]) expect(text).toContain(flag);
    });

    it("turns an exported HTML page into one A4 PDF page with extractable text", async () => {
        const dir = mkdtempSync(join(tmpdir(), "enginecv-pdf-"));
        try {
            const html = join(dir, "in.html");
            const pdf = join(dir, "out.pdf");
            writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:0}body{margin:0;font:12pt serif}.page{width:210mm;height:297mm;padding:20mm;box-sizing:border-box}</style></head><body><div class="page"><h1>Amina Hodzic</h1><p>Staff Software Engineer</p></div></body></html>`);
            execFileSync(chrome!, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=5000", `--print-to-pdf=${pdf}`, pathToFileURL(html).href], { stdio: "ignore", timeout: 60_000 });
            await waitUntilStable(pdf); // the recipe's own rule: Chrome can return before the file is visible
            expect(existsSync(pdf)).toBe(true);
            const size = statSync(pdf).size;
            expect(size).toBeGreaterThan(1000);
            const bytes = readFileSync(pdf).toString("latin1");
            expect((bytes.match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
            // A4 is 595 x 842 points.
            expect(bytes).toMatch(/\/MediaBox\s*\[\s*0\s+0\s+(594|595|596)(\.\d+)?\s+(841|842)(\.\d+)?\s*\]/);
            // Text is selectable, not an image: read it back when poppler's pdftotext is installed.
            try {
                const text = execFileSync("pdftotext", [pdf, "-"], { encoding: "utf8", timeout: 20_000 });
                expect(text).toContain("Amina Hodzic");
            } catch (error) {
                if ((error as { code?: string }).code !== "ENOENT") throw error;
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 90_000);
});
