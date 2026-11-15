import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResumePreview } from "@/components/editor/ResumePreview";
import { ExportEmbedError, assertSelfContained } from "@/lib/export-embed";
import { __testing, buildSelfContainedHtmlDocument } from "@/lib/export";
import { createEmptyResume } from "@/lib/schema";
import { useResumeStore } from "@/lib/store";

const APP_CSS = [
    "@font-face{font-family:Inter;font-weight:100 900;src:url(/_next/static/media/inter.woff2) format('woff2');unicode-range:U+0000-00FF}",
    "@font-face{font-family:Inter;font-weight:100 900;src:url(/_next/static/media/inter-cyr.woff2) format('woff2');unicode-range:U+0400-045F}",
    ".tw-flex{display:flex}",
    ".bg{background:url(/_next/static/media/bg.png)}",
].join("\n");

function response(body: string | Uint8Array, ok = true, type?: string): Response {
    const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
    return {
        ok,
        status: ok ? 200 : 500,
        headers: new Headers({ "content-type": type ?? (typeof body === "string" ? "text/css" : "image/png") }),
        text: async () => (typeof body === "string" ? body : ""),
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    } as unknown as Response;
}

async function renderPreview(options: { hiddenEntry?: boolean } = {}) {
    const resume = createEmptyResume();
    resume.basics.name = "Jane Doe";
    resume.basics.email = "jane@example.com";
    resume.settings.contentSections = ["experience"];
    resume.experience = [
        {
            id: "e1", hidden: false, company: "Acme Systems", position: "Senior Engineer", start: "2024-01", end: "Present",
            location: "Remote", description: "Led platform delivery", highlights: [], skills: [], url: "https://acme.example/careers", urlIcon: "auto",
        },
        ...(options.hiddenEntry ? [{
            id: "e2", hidden: true, company: "Secret Corp", position: "Hidden Role", start: "2020-01", end: "2021-01",
            location: "", description: "", highlights: [], skills: [], url: "", urlIcon: "auto",
        }] : []),
    ];
    useResumeStore.setState({ resume, paperSize: "a4" });
    const view = render(<ResumePreview />);
    await waitFor(() => expect(document.querySelector(".resume-page")?.textContent).toContain("Acme Systems"));
    // jsdom does not compute the template's font from the scoped stylesheet, so say it directly.
    document.querySelectorAll<HTMLElement>(".resume-page").forEach((page) => { page.style.fontFamily = "Inter, sans-serif"; });
    return view;
}

describe("buildSelfContainedHtmlDocument", () => {
    beforeEach(() => {
        document.head.innerHTML = [
            '<link rel="stylesheet" href="http://site.test/_next/static/css/app.css">',
            "<style>.resume-scope-x{color:#111}</style>",
        ].join("");
        // A FontFaceSet stand-in: the preview waits on `ready` and listens for loading events.
        const fontSet = Object.assign(new Set([{ family: "Inter" }]), {
            ready: Promise.resolve(),
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
        });
        Object.defineProperty(document, "fonts", { configurable: true, value: fontSet });
        vi.stubGlobal("fetch", vi.fn(async (url: string) => {
            if (String(url).endsWith(".css")) return response(APP_CSS);
            if (String(url).endsWith("bg.png")) return response(new Uint8Array([1, 2, 3]));
            if (String(url).endsWith("inter.woff2")) return response(new Uint8Array([9, 9, 9]), true, "font/woff2");
            return response("", false);
        }));
    });
    afterEach(() => {
        cleanup();
        document.head.innerHTML = "";
        delete (document as unknown as Record<string, unknown>).fonts;
        vi.unstubAllGlobals();
    });

    it("returns null when no preview pages are mounted", async () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        expect(await buildSelfContainedHtmlDocument("a4", "resume.html")).toBeNull();
        spy.mockRestore();
    });

    it("produces one document with no link, base, script or server reference, but keeps hyperlinks", async () => {
        await renderPreview();

        const result = await buildSelfContainedHtmlDocument("a4", "resume-jane.html");

        expect(result).not.toBeNull();
        const html = result!.html;
        expect(assertSelfContained(html)).toEqual([]);
        expect(html).not.toContain("<base");
        expect(html).not.toContain("<link");
        expect(html).toContain(".tw-flex{display:flex}");
        expect(html).toContain("data:image/png;base64,AQID");
        expect(html).toContain("data:font/woff2;base64,CQkJ");
        expect(html).not.toContain("inter.woff2");
        // Only the Latin subset is used by this CV; the Cyrillic one is left out.
        expect(html).not.toContain("inter-cyr");
        expect((html.match(/@font-face/g) ?? []).length).toBe(1);
        expect(html).toContain("href=\"https://acme.example/careers\"");
        expect(html).toContain("href=\"mailto:jane@example.com\"");
        expect(result!.fallbackFonts).toEqual([]);
    });

    it("uses the same page markup and page rules as the PDF print path", async () => {
        const { container } = await renderPreview();
        const pages = Array.from(container.querySelectorAll<HTMLElement>(".resume-page"));
        const expectedMarkup = pages.map((page) => __testing.preparePageForPrint(page).outerHTML).join("\n");
        const { width, height } = __testing.getIntrinsicPageSize(pages[0]);

        const result = await buildSelfContainedHtmlDocument("a4", "resume-jane.html");

        expect(result!.html).toContain(expectedMarkup);
        expect(result!.html).toContain(`width: ${width}px !important;`);
        expect(result!.html).toContain(`height: ${height}px !important;`);
        expect(result!.html).toContain("size: A4;");
    });

    it("leaves hidden entries out, as the preview does", async () => {
        await renderPreview({ hiddenEntry: true });

        const result = await buildSelfContainedHtmlDocument("a4", "resume-jane.html");

        expect(result!.html).toContain("Acme Systems");
        expect(result!.html).not.toContain("Secret Corp");
    });

    it("rejects, with no document, when a stylesheet cannot be read", async () => {
        await renderPreview();
        vi.stubGlobal("fetch", vi.fn(async () => response("", false)));

        await expect(buildSelfContainedHtmlDocument("a4", "resume-jane.html")).rejects.toBeInstanceOf(ExportEmbedError);
    });

    it("reports a font that could not be embedded", async () => {
        await renderPreview();
        // The stylesheet and the background image load; only the font file fails.
        vi.stubGlobal("fetch", vi.fn(async (url: string) => {
            if (String(url).endsWith(".css")) return response(APP_CSS);
            if (String(url).endsWith("bg.png")) return response(new Uint8Array([1, 2, 3]));
            return response("", false);
        }));

        const result = await buildSelfContainedHtmlDocument("a4", "resume-jane.html");

        expect(result!.fallbackFonts).toEqual(["Inter"]);
        expect(assertSelfContained(result!.html)).toEqual([]);
    });
});
