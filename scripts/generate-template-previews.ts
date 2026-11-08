/* eslint-disable no-console */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser } from "@playwright/test";
import { getBuiltinTemplates } from "../src/lib/templates/enginecv-templates";

const PORT = Number(process.env.SNAPSHOT_PORT ?? 3211);
const EXTERNAL_BASE_URL = process.env.SNAPSHOT_BASE_URL?.replace(/\/$/, "");
const BASE_URL = EXTERNAL_BASE_URL ?? `http://localhost:${PORT}`;
const SHOULD_START_SERVER = !EXTERNAL_BASE_URL;
const OUTPUT_DIR = path.join(process.cwd(), "public", "template-previews");
const DEVICE_SCALE_FACTOR = 2;
// Responsive WebP widths served by TemplatePreviewCard. Keep in sync with
// TEMPLATE_PREVIEW_WIDTHS there. The full PNG stays as the fallback.
const WEBP_WIDTHS = [480, 960] as const;
const WEBP_QUALITY = 0.82;

async function waitForServer(url: string, timeoutMs = 120_000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch(url);
            if (res.ok || res.status === 404) return;
        } catch {
            // not ready
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

function startDevServer(): ChildProcess {
    console.log(`Starting Next dev server on port ${PORT}…`);
    const child = spawn("npm", ["run", "dev", "--", "--port", String(PORT)], {
        cwd: process.cwd(),
        env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
        stdio: ["ignore", "inherit", "inherit"],
        shell: process.platform === "win32",
    });
    child.on("exit", (code) => {
        if (code !== null && code !== 0) {
            console.error(`Dev server exited with code ${code}`);
        }
    });
    return child;
}

async function snapshotTemplate(browser: Browser, id: string) {
    const page = await browser.newPage({
        viewport: { width: 794, height: 1123 },
        deviceScaleFactor: DEVICE_SCALE_FACTOR,
    });

    // Builds with ads enabled show the consent prompt over the page, which would
    // then be baked into the preview image. Start from a visitor who declined.
    await page.addInitScript(() => {
        try {
            localStorage.setItem(
                "enginecv-consent",
                JSON.stringify({ version: 2, ads: "denied", decidedAt: "2026-01-01T00:00:00.000Z" }),
            );
        } catch {
            // Private mode or blocked storage: the prompt may then appear.
        }
    });

    const url = `${BASE_URL}/internal/template-snapshot/${id}`;
    console.log(`  → ${url}`);

    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });

    const root = page.locator("[data-snapshot-root]");
    await root.waitFor({ state: "attached", timeout: 30_000 });

    await page.waitForFunction(
        `document.querySelector("[data-snapshot-root]")?.getAttribute("data-ready") === "true"`,
        { timeout: 30_000 },
    );

    const buffer = await root.screenshot({
        type: "png",
        omitBackground: false,
    });

    await page.close();
    return buffer;
}

// Chromium's canvas encodes WebP, so the resized variants need no image library.
async function encodeWebpVariants(browser: Browser, png: Buffer) {
    const page = await browser.newPage();
    try {
        const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
        const encoded = await page.evaluate(
            async ({ src, widths, quality }) => {
                const img = new Image();
                img.src = src;
                await img.decode();
                return widths.map((width) => {
                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = Math.round((img.naturalHeight * width) / img.naturalWidth);
                    const ctx = canvas.getContext("2d")!;
                    ctx.imageSmoothingQuality = "high";
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    return canvas.toDataURL("image/webp", quality).split(",")[1];
                });
            },
            { src: dataUrl, widths: [...WEBP_WIDTHS], quality: WEBP_QUALITY },
        );
        return WEBP_WIDTHS.map((width, i) => ({ width, buffer: Buffer.from(encoded[i], "base64") }));
    } finally {
        await page.close();
    }
}

async function main() {
    await mkdir(OUTPUT_DIR, { recursive: true });

    const templates = getBuiltinTemplates();
    console.log(`Generating ${templates.length} template preview(s)…`);

    const server: ChildProcess | null = SHOULD_START_SERVER ? startDevServer() : null;
    if (!SHOULD_START_SERVER) {
        console.log(`Using existing server at ${BASE_URL}`);
    }
    let browser: Browser | undefined;
    const manifest: Array<{ id: string; name: string; file: string; width: number; height: number }> = [];

    try {
        await waitForServer(BASE_URL);
        browser = await chromium.launch();

        for (const template of templates) {
            console.log(`• ${template.id} (${template.meta.name})`);
            const buffer = await snapshotTemplate(browser, template.id);
            const file = `${template.id}.png`;
            await writeFile(path.join(OUTPUT_DIR, file), buffer);
            for (const variant of await encodeWebpVariants(browser, buffer)) {
                await writeFile(path.join(OUTPUT_DIR, `${template.id}-${variant.width}.webp`), variant.buffer);
            }
            manifest.push({
                id: template.id,
                name: template.meta.name,
                file,
                width: 794 * DEVICE_SCALE_FACTOR,
                height: 1123 * DEVICE_SCALE_FACTOR,
            });
        }

        await writeFile(
            path.join(OUTPUT_DIR, "manifest.json"),
            JSON.stringify({ generatedAt: new Date().toISOString(), entries: manifest }, null, 2),
        );

        console.log(`Done. Wrote ${manifest.length} preview(s) to ${OUTPUT_DIR}`);
    } finally {
        await browser?.close().catch(() => undefined);
        if (server && !server.killed) {
            server.kill();
        }
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
