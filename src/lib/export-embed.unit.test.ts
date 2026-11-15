import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    ExportEmbedError,
    assertSelfContained,
    buildEmbeddedStyles,
    collectDocumentStyles,
    collectFontUsage,
    embedFontFaces,
    inlineCssUrls,
    keepBestFontSource,
    parseFontFaces,
    parseUnicodeRanges,
    readStylesheetText,
    selectFontFaces,
    stripFontFaceRules,
    type FontUsage,
} from "./export-embed";

function response(body: string | Uint8Array, init: { ok?: boolean; status?: number; type?: string } = {}): Response {
    const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
    return {
        ok: init.ok ?? true,
        status: init.status ?? 200,
        headers: new Headers(init.type ? { "content-type": init.type } : {}),
        text: async () => (typeof body === "string" ? body : new TextDecoder().decode(bytes)),
        arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    } as unknown as Response;
}

describe("stripFontFaceRules", () => {
    it("removes every @font-face block, including inside @layer, and keeps other rules", () => {
        const css = [
            "@font-face { font-family: A; src: url(a.woff2); }",
            "@layer base { @font-face { font-family: B; src: url(b.woff2) format('woff2'); } .keep { color: red; } }",
            ".plain { margin: 0; }",
        ].join("\n");

        const out = stripFontFaceRules(css);

        expect(out).not.toContain("@font-face");
        expect(out).not.toContain("a.woff2");
        expect(out).toContain(".keep { color: red; }");
        expect(out).toContain(".plain { margin: 0; }");
    });
});

describe("inlineCssUrls", () => {
    it("turns a relative url() into a data URI resolved against the stylesheet address", async () => {
        const fetchImpl = vi.fn(async () => response(new Uint8Array([1, 2, 3]), { type: "image/png" }));

        const out = await inlineCssUrls(".a { background: url(../media/p.png); }", "http://site.test/_next/static/css/app.css", fetchImpl);

        expect(fetchImpl).toHaveBeenCalledWith("http://site.test/_next/static/media/p.png", { cache: "force-cache" });
        expect(out).toContain('url("data:image/png;base64,AQID")');
        expect(out).not.toContain("../media");
    });

    it("leaves data URIs and fragment references alone and fetches nothing for them", async () => {
        const fetchImpl = vi.fn();
        const css = '.a { background: url("data:image/svg+xml;base64,AAAA"); filter: url(#blur); }';

        expect(await inlineCssUrls(css, "http://site.test/a.css", fetchImpl)).toBe(css);
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("fetches each distinct asset once", async () => {
        const fetchImpl = vi.fn(async () => response(new Uint8Array([9]), { type: "image/png" }));

        await inlineCssUrls(".a{background:url(x.png)} .b{background:url('x.png')}", "http://site.test/a.css", fetchImpl);

        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("fails the export when an asset cannot be fetched, instead of leaving a live link", async () => {
        await expect(inlineCssUrls(".a{background:url(x.png)}", "http://site.test/a.css", async () => { throw new Error("offline"); }))
            .rejects.toMatchObject({ name: "ExportEmbedError", code: "asset" });
        await expect(inlineCssUrls(".a{background:url(x.png)}", "http://site.test/a.css", async () => response("", { ok: false, status: 404 })))
            .rejects.toBeInstanceOf(ExportEmbedError);
    });

    it("refuses an asset that is too large to embed", async () => {
        const big = new Uint8Array(1_000_001);
        await expect(inlineCssUrls(".a{background:url(x.png)}", "http://site.test/a.css", async () => response(big)))
            .rejects.toMatchObject({ code: "asset" });
    });
});

describe("readStylesheetText", () => {
    function link(href: string, rules?: string[] | "throws"): HTMLLinkElement {
        const element = document.createElement("link");
        element.rel = "stylesheet";
        element.href = href;
        if (rules === "throws") {
            Object.defineProperty(element, "sheet", { get: () => ({ get cssRules(): never { throw new DOMException("blocked", "SecurityError"); } }) });
        } else if (rules) {
            Object.defineProperty(element, "sheet", { value: { cssRules: rules.map((cssText) => ({ cssText })) } });
        }
        return element;
    }

    it("uses the fetched text", async () => {
        const text = await readStylesheetText(link("http://site.test/a.css"), async () => response(".a{}"));
        expect(text).toBe(".a{}");
    });

    it("falls back to the parsed rules when fetching fails", async () => {
        const text = await readStylesheetText(link("http://site.test/a.css", [".a{color:red}", ".b{margin:0}"]), async () => { throw new Error("offline"); });
        expect(text).toBe(".a{color:red}\n.b{margin:0}");
    });

    it("fails with a stylesheet error when neither source works", async () => {
        await expect(readStylesheetText(link("http://site.test/a.css", "throws"), async () => response("", { ok: false, status: 500 })))
            .rejects.toMatchObject({ name: "ExportEmbedError", code: "stylesheet" });
    });
});

describe("assertSelfContained", () => {
    const ok = `<!DOCTYPE html><html><head><style>.a{color:red;background:url("data:image/png;base64,AA")}</style></head>
        <body><a href="https://example.com/portfolio">Portfolio</a><p>See https://example.com and /root/path in text</p>
        <img src="data:image/png;base64,AA"><svg><use href="#icon"></use></svg></body></html>`;

    it("accepts a document with inline styles, data URIs, fragments and hyperlinks", () => {
        expect(assertSelfContained(ok)).toEqual([]);
    });

    it("flags <link>, <base> and <script>", () => {
        const html = `<html><head><base href="http://x/"><link rel="stylesheet" href="a.css"><script>1</script></head><body></body></html>`;
        const problems = assertSelfContained(html);
        expect(problems).toEqual(expect.arrayContaining(["contains a <link>", "contains a <base>", "contains a <script>"]));
    });

    it("flags rendering assets that point at a server, but not hyperlinks", () => {
        expect(assertSelfContained(`<body><img src="http://x/p.png"></body>`).join()).toContain("<img src>");
        expect(assertSelfContained(`<body><img src="/photo.png"></body>`).join()).toContain("<img src>");
        expect(assertSelfContained(`<body><img src="blob:http://x/1"></body>`).join()).toContain("<img src>");
        expect(assertSelfContained(`<body><svg><image href="https://x/i.png"/></svg></body>`).length).toBeGreaterThan(0);
        expect(assertSelfContained(`<body><a href="/relative">x</a></body>`)).toEqual([]);
    });

    it("flags a url() or @import in styles that points at a server", () => {
        expect(assertSelfContained(`<head><style>.a{background:url(https://x/y.png)}</style></head>`).join()).toContain("url()");
        expect(assertSelfContained(`<head><style>.a{background:url('/y.png')}</style></head>`).join()).toContain("url()");
        expect(assertSelfContained(`<head><style>@import "x.css";</style></head>`).join()).toContain("@import");
        expect(assertSelfContained(`<body><p style="background:url(/y.png)">x</p></body>`).join()).toContain("style");
    });
});

const LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+2000-206F";
const LATIN_EXT = "U+0100-02AF, U+1E00-1EFF";
const CYRILLIC = "U+0301, U+0400-045F";
const faceCss = (family: string, range: string, weight = "100 900", style = "normal") =>
    `@font-face{font-family:${family};font-style:${style};font-weight:${weight};src:url(/m/${family}-${range.slice(2, 6)}-${weight.replace(" ", "_")}-${style}.woff2) format("woff2");unicode-range:${range}}`;

function usageOf(family: string, text: string, weights = [400], styles = ["normal"]): Map<string, FontUsage> {
    const codePoints = new Set<number>();
    for (const char of text + text.toUpperCase()) codePoints.add(char.codePointAt(0) as number);
    return new Map([[family, { weights: new Set(weights), styles: new Set(styles), codePoints }]]);
}

describe("parseUnicodeRanges", () => {
    it("reads single code points, ranges and wildcards", () => {
        expect(parseUnicodeRanges("U+0000-00FF, U+0131, U+4??")).toEqual([[0, 255], [0x131, 0x131], [0x400, 0x4ff]]);
        expect(parseUnicodeRanges("u+0301")).toEqual([[0x301, 0x301]]);
        expect(parseUnicodeRanges("garbage")).toEqual([]);
    });
});

describe("parseFontFaces", () => {
    it("reads family, style, weight range and unicode range", () => {
        const [face] = parseFontFaces(faceCss("Inter", LATIN, "100 900", "italic"));
        expect(face).toMatchObject({ family: "Inter", style: "italic", weight: [100, 900] });
        expect(face.ranges?.[0]).toEqual([0, 255]);
    });

    it("treats a face without unicode-range as covering everything, and reads single weights", () => {
        const [face] = parseFontFaces(`@font-face{font-family:"Lora";font-weight:700;src:url(a.woff2)}`);
        expect(face).toMatchObject({ family: "Lora", weight: [700, 700], style: "normal", ranges: null });
    });
});

describe("keepBestFontSource", () => {
    it("keeps only the woff2 source when woff2 and woff are listed", () => {
        const text = '@font-face{font-family:Inter;src:url(/a.woff) format("woff"), url(/a.woff2) format("woff2");unicode-range:U+0000-00FF}';
        const out = keepBestFontSource(text);
        expect(out).toContain("/a.woff2");
        expect(out).not.toContain('/a.woff)');
        expect(out).toContain("unicode-range:U+0000-00FF");
    });

    it("recognises woff2 by extension when there is no format hint, and keeps the first source otherwise", () => {
        expect(keepBestFontSource("@font-face{font-family:A;src:url(a.ttf),url(a.woff2)}")).toContain("a.woff2");
        expect(keepBestFontSource("@font-face{font-family:A;src:url(a.ttf),url(a.otf)}")).toContain("a.ttf");
        expect(keepBestFontSource("@font-face{font-family:A;src:url(a.ttf),url(a.otf)}")).not.toContain("a.otf");
    });

    it("leaves a face with a single source, or a data URI containing commas, alone", () => {
        const single = "@font-face{font-family:A;src:url(a.woff2) format('woff2')}";
        expect(keepBestFontSource(single)).toBe(single);
        const data = "@font-face{font-family:A;src:url(data:font/woff2;base64,AAAA)}";
        expect(keepBestFontSource(data)).toBe(data);
    });
});

describe("selectFontFaces", () => {
    const faces = parseFontFaces([
        faceCss("Inter", LATIN),
        faceCss("Inter", LATIN_EXT),
        faceCss("Inter", CYRILLIC),
        faceCss("Geist", LATIN),
    ].join("\n"));

    it("keeps only the subsets whose characters the pages use", () => {
        const picked = selectFontFaces(faces, usageOf("Inter", "Jane Doe"));
        expect(picked.map((face) => face.ranges?.[0][0])).toEqual([0]);
    });

    it("adds the Latin Extended subset for ć and the Cyrillic one for ж", () => {
        const picked = selectFontFaces(faces, usageOf("Inter", "Šehić Железо"));
        expect(picked.map((face) => face.ranges?.[0][0]).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([0, 0x100, 0x301]);
    });

    it("ignores families the pages do not use", () => {
        const picked = selectFontFaces(faces, usageOf("Inter", "Hello"));
        expect(picked.every((face) => face.family === "Inter")).toBe(true);
    });

    it("picks the face matching the used weight and style when the family ships several", () => {
        const set = parseFontFaces([
            faceCss("Lora", LATIN, "400", "normal"),
            faceCss("Lora", LATIN, "700", "normal"),
            faceCss("Lora", LATIN, "400", "italic"),
        ].join("\n"));
        const picked = selectFontFaces(set, usageOf("Lora", "Text", [700], ["normal"]));
        expect(picked).toHaveLength(1);
        expect(picked[0].weight).toEqual([700, 700]);
    });

    it("keeps the range-matching faces when the exact weight is not shipped (the browser synthesises it)", () => {
        const set = parseFontFaces(faceCss("Lora", LATIN, "400", "normal"));
        expect(selectFontFaces(set, usageOf("Lora", "Text", [700], ["normal"]))).toHaveLength(1);
    });
});

describe("embedFontFaces", () => {
    const fontResponse = () => response(new Uint8Array([7, 7]), { type: "font/woff2" });

    it("inlines only the selected faces as data URIs", async () => {
        const faces = parseFontFaces([faceCss("Inter", LATIN), faceCss("Inter", CYRILLIC)].join("\n"));
        const fetchImpl = vi.fn(async () => fontResponse());

        const result = await embedFontFaces([{ faces, baseUrl: "http://site.test/a.css" }], usageOf("Inter", "Hello"), fetchImpl);

        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(result.css).toContain("data:font/woff2;base64,Bwc=");
        expect(result.css).not.toContain("http://site.test");
        expect(result.fallbackFamilies).toEqual([]);
    });

    it("drops a face that cannot be fetched and reports the family as replaced", async () => {
        const faces = parseFontFaces(faceCss("Inter", LATIN));

        const result = await embedFontFaces([{ faces, baseUrl: "http://site.test/a.css" }], usageOf("Inter", "Hello"), async () => response("", { ok: false, status: 404 }));

        expect(result.css).toBe("");
        expect(result.fallbackFamilies).toEqual(["Inter"]);
    });

    it("does not report a family that has no web font at all (a system font)", async () => {
        const result = await embedFontFaces([{ faces: [], baseUrl: "http://site.test/a.css" }], usageOf("Georgia", "Hello"), vi.fn());
        expect(result.fallbackFamilies).toEqual([]);
    });
});

describe("collectFontUsage and buildEmbeddedStyles", () => {
    beforeEach(() => {
        document.head.innerHTML = [
            '<link rel="stylesheet" href="http://site.test/_next/static/css/app.css">',
            "<style>.resume-scope-x{color:red}</style>",
        ].join("");
    });
    afterEach(() => {
        document.head.innerHTML = "";
        document.body.innerHTML = "";
    });

    function page(html: string): HTMLElement {
        const node = document.createElement("div");
        node.innerHTML = html;
        document.body.appendChild(node);
        return node;
    }

    it("collects family, weight, style and characters (both cases) from the text drawn", () => {
        const usage = collectFontUsage([page(`<p style="font-family:Inter,sans-serif;font-weight:700">Šehić</p><p style="font-family:Georgia">skip me</p>`)]);

        const inter = usage.get("Inter");
        expect(inter?.weights.has(700)).toBe(true);
        expect(inter?.codePoints.has("ć".codePointAt(0) as number)).toBe(true);
        expect(inter?.codePoints.has("Ć".codePointAt(0) as number)).toBe(true);
        // A base set (digits, dashes, bullets) is always present.
        expect(inter?.codePoints.has("•".codePointAt(0) as number)).toBe(true);
    });

    it("collects the document's own styles without @font-face", () => {
        const styles = collectDocumentStyles(document);
        expect(styles).toContain(".resume-scope-x{color:red}");
        expect(styles).not.toContain("@font-face");
    });

    it("builds head styles with CSS inlined, only the used font faces embedded, and no link", async () => {
        const css = `${faceCss("Inter", LATIN)}\n${faceCss("Inter", CYRILLIC)}\n.tw{display:flex}`;
        const fetchImpl = vi.fn(async (url: string) =>
            url.endsWith(".css") ? response(css, { type: "text/css" }) : response(new Uint8Array([1, 2, 3]), { type: "font/woff2" }));

        const { styles, fallbackFamilies } = await buildEmbeddedStyles([page(`<p style="font-family:Inter">Hello</p>`)], { fetchImpl });

        expect(styles).toContain(".tw{display:flex}");
        expect(styles.match(/@font-face/g)).toHaveLength(1);
        expect(styles).toContain("data:font/woff2;base64,AQID");
        expect(styles).not.toContain("<link");
        expect(fallbackFamilies).toEqual([]);
        expect(assertSelfContained(`<html><head>${styles}</head><body></body></html>`)).toEqual([]);
    });

    it("reports a font that could not be embedded so the dialog can say it was replaced", async () => {
        const fetchImpl = vi.fn(async (url: string) =>
            url.endsWith(".css") ? response(faceCss("Inter", LATIN), { type: "text/css" }) : response("", { ok: false, status: 404 }));

        const { fallbackFamilies } = await buildEmbeddedStyles([page(`<p style="font-family:Inter">Hello</p>`)], { fetchImpl });

        expect(fallbackFamilies).toEqual(["Inter"]);
    });

    it("fails when a stylesheet cannot be read at all", async () => {
        const fetchImpl = vi.fn(async () => response("", { ok: false, status: 500 }));

        await expect(buildEmbeddedStyles([page("<p>x</p>")], { fetchImpl })).rejects.toMatchObject({ code: "stylesheet" });
    });
});
