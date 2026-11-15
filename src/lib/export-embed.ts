/**
 * Helpers that turn the live editor page into one self-contained HTML file:
 * the app's stylesheet text, only the font files the pages really draw with,
 * and a check that nothing left in the document points back at a server.
 *
 * The print window keeps using live links (see export.ts); only the downloaded
 * file and the clipboard copy go through here.
 */

export type ExportEmbedErrorCode = "stylesheet" | "asset" | "font" | "not-self-contained";

export class ExportEmbedError extends Error {
    constructor(
        readonly code: ExportEmbedErrorCode,
        message: string,
    ) {
        super(message);
        this.name = "ExportEmbedError";
    }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Largest single asset (font or image) that is inlined into a stylesheet. */
const MAX_INLINE_ASSET_BYTES = 1_000_000;

/** Text of one stylesheet: the browser's cached copy, else its parsed rules. */
export async function readStylesheetText(link: HTMLLinkElement, fetchImpl: FetchLike = fetch): Promise<string> {
    try {
        const response = await fetchImpl(link.href, { cache: "force-cache" });
        if (response.ok) return await response.text();
    } catch {
        // fall through to the parsed rules
    }
    try {
        const rules = link.sheet?.cssRules;
        if (rules) return Array.from(rules).map((rule) => rule.cssText).join("\n");
    } catch {
        // cross-origin sheet: rules are not readable
    }
    throw new ExportEmbedError("stylesheet", `Could not read stylesheet ${link.href}`);
}

const FONT_FACE_PATTERN = /@font-face\s*\{[^}]*\}/g;

/** Removes every @font-face block; the used ones are embedded separately. */
export function stripFontFaceRules(css: string): string {
    return css.replace(FONT_FACE_PATTERN, "");
}

function toBase64(bytes: Uint8Array): string {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
}

/**
 * Replaces every `url(...)` that points at a fetchable asset with a data URI.
 * Data URIs and fragment references stay as they are. An asset that cannot be
 * fetched fails the export: a leftover live link is exactly what is being fixed.
 */
export async function inlineCssUrls(css: string, baseUrl: string, fetchImpl: FetchLike = fetch): Promise<string> {
    const pattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
    const found = new Map<string, string>();
    for (const match of css.matchAll(pattern)) {
        const raw = match[2].trim();
        if (raw.startsWith("data:") || raw.startsWith("#")) continue;
        found.set(raw, new URL(raw, baseUrl).href);
    }
    const replacements = new Map<string, string>();
    for (const [raw, absolute] of found) {
        let response: Response;
        try {
            response = await fetchImpl(absolute, { cache: "force-cache" });
        } catch {
            throw new ExportEmbedError("asset", `Could not fetch ${absolute}`);
        }
        if (!response.ok) throw new ExportEmbedError("asset", `Could not fetch ${absolute} (${response.status})`);
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length > MAX_INLINE_ASSET_BYTES) throw new ExportEmbedError("asset", `${absolute} is too large to embed`);
        const type = response.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
        replacements.set(raw, `data:${type};base64,${toBase64(bytes)}`);
    }
    return css.replace(pattern, (whole, _quote: string, raw: string) => {
        const data = replacements.get(raw.trim());
        return data ? `url("${data}")` : whole;
    });
}

/** The document's own <style> tags (per-CV scoped styles), without @font-face. */
export function collectDocumentStyles(doc: Document = document): string {
    return Array.from(doc.querySelectorAll<HTMLStyleElement>("style"))
        .map((style) => stripFontFaceRules(style.textContent ?? ""))
        .filter((text) => text.trim() !== "")
        .map((text) => `<style>${text}</style>`)
        .join("\n");
}

// ---------------------------------------------------------------------------
// Fonts: embed only the faces the pages draw with
// ---------------------------------------------------------------------------

export interface FontFaceRule {
    /** The whole `@font-face{...}` text. */
    text: string;
    family: string;
    style: string;
    /** Inclusive weight range; a single weight has min === max. */
    weight: [number, number];
    /** Code point ranges, or null when the face covers everything. */
    ranges: Array<[number, number]> | null;
}

function declaration(block: string, property: string): string | null {
    const match = block.match(new RegExp(`(?:^|[;{\\s])${property}\\s*:\\s*([^;}]+)`, "i"));
    return match ? match[1].trim() : null;
}

function parseWeight(value: string | null): [number, number] {
    if (!value) return [400, 400];
    const words: Record<string, number> = { normal: 400, bold: 700 };
    const numbers = value.split(/\s+/).map((part) => words[part.toLowerCase()] ?? Number(part)).filter((n) => Number.isFinite(n));
    if (numbers.length === 0) return [400, 400];
    return [Math.min(...numbers), Math.max(...numbers)];
}

/** `U+0000-00FF, U+0131, U+4??` into inclusive ranges. */
export function parseUnicodeRanges(value: string): Array<[number, number]> {
    const ranges: Array<[number, number]> = [];
    for (const part of value.split(",")) {
        const match = part.trim().match(/^U\+([0-9a-f?]+)(?:-([0-9a-f]+))?$/i);
        if (!match) continue;
        if (match[1].includes("?")) {
            ranges.push([parseInt(match[1].replace(/\?/g, "0"), 16), parseInt(match[1].replace(/\?/g, "f"), 16)]);
        } else {
            const start = parseInt(match[1], 16);
            ranges.push([start, match[2] ? parseInt(match[2], 16) : start]);
        }
    }
    return ranges;
}

export function parseFontFaces(css: string): FontFaceRule[] {
    const rules: FontFaceRule[] = [];
    for (const match of css.matchAll(FONT_FACE_PATTERN)) {
        const block = match[0];
        const family = declaration(block, "font-family");
        if (!family) continue;
        const range = declaration(block, "unicode-range");
        rules.push({
            text: block,
            family: family.replace(/^["']|["']$/g, ""),
            style: (declaration(block, "font-style") ?? "normal").toLowerCase(),
            weight: parseWeight(declaration(block, "font-weight")),
            ranges: range ? parseUnicodeRanges(range) : null,
        });
    }
    return rules;
}

/**
 * Keeps one source per face: the woff2 one when there is a choice, else the
 * first. Faces list woff2 and woff side by side for old browsers; embedding both
 * would double the file for nothing.
 */
export function keepBestFontSource(faceText: string): string {
    const match = faceText.match(/(src\s*:\s*)([^;}]+)/i);
    if (!match) return faceText;
    const sources: string[] = [];
    let depth = 0;
    let current = "";
    for (const char of match[2]) {
        if (char === "(") depth += 1;
        if (char === ")") depth -= 1;
        if (char === "," && depth === 0) { sources.push(current.trim()); current = ""; } else current += char;
    }
    if (current.trim()) sources.push(current.trim());
    if (sources.length < 2) return faceText;
    const best = sources.find((source) => /format\(\s*['"]?woff2['"]?\s*\)/i.test(source) || /\.woff2(\?|\)|["'\s])/i.test(source)) ?? sources[0];
    return faceText.replace(match[0], match[1] + best);
}

export interface FontUsage {
    weights: Set<number>;
    styles: Set<string>;
    codePoints: Set<number>;
}

const GENERIC_FAMILIES = new Set([
    "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-serif", "ui-sans-serif",
    "ui-monospace", "ui-rounded", "emoji", "math", "fangsong", "inherit", "initial",
]);

/** Letters and punctuation that appear without being typed (bullets, dashes, dots). */
const ALWAYS_NEEDED = "0123456789 .,;:!?-_()[]/&@#%+=*'\"•–—…·";

function addCodePoints(target: Set<number>, text: string) {
    for (const variant of [text, text.toUpperCase(), text.toLowerCase()]) {
        for (const char of variant) target.add(char.codePointAt(0) as number);
    }
}

/**
 * Which families, weights, styles and characters the pages really draw. Case
 * variants are included because headings are often upper-cased by CSS.
 */
export function collectFontUsage(pageNodes: HTMLElement[]): Map<string, FontUsage> {
    const usage = new Map<string, FontUsage>();
    const entryFor = (element: Element): FontUsage | null => {
        const style = getComputedStyle(element);
        const family = (style.fontFamily || "").split(",")[0].trim().replace(/^["']|["']$/g, "");
        if (!family || GENERIC_FAMILIES.has(family.toLowerCase())) return null;
        let entry = usage.get(family);
        if (!entry) {
            entry = { weights: new Set(), styles: new Set(), codePoints: new Set() };
            addCodePoints(entry.codePoints, ALWAYS_NEEDED);
            usage.set(family, entry);
        }
        const weight = style.fontWeight === "bold" ? 700 : style.fontWeight === "normal" ? 400 : Number(style.fontWeight);
        entry.weights.add(Number.isFinite(weight) ? weight : 400);
        entry.styles.add((style.fontStyle || "normal").toLowerCase().startsWith("oblique") ? "italic" : (style.fontStyle || "normal").toLowerCase());
        return entry;
    };
    for (const page of pageNodes) {
        const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.textContent ?? "";
            if (text.trim() === "" || !node.parentElement) continue;
            const entry = entryFor(node.parentElement);
            if (entry) addCodePoints(entry.codePoints, text);
        }
        entryFor(page);
    }
    return usage;
}

function rangesIntersect(ranges: Array<[number, number]>, codePoints: Set<number>): boolean {
    for (const point of codePoints) {
        for (const [start, end] of ranges) {
            if (point >= start && point <= end) return true;
        }
    }
    return false;
}

/** The faces worth embedding: right family, characters, weight and style. */
export function selectFontFaces(faces: FontFaceRule[], usage: Map<string, FontUsage>): FontFaceRule[] {
    const selected: FontFaceRule[] = [];
    for (const [family, used] of usage) {
        const candidates = faces
            .filter((face) => face.family === family)
            .filter((face) => face.ranges === null || rangesIntersect(face.ranges, used.codePoints));
        const matching = candidates.filter((face) =>
            used.styles.has(face.style) && Array.from(used.weights).some((w) => w >= face.weight[0] && w <= face.weight[1]),
        );
        // A weight or style the family does not ship is synthesised by the browser
        // from what it has, so keep the range-matching faces rather than nothing.
        selected.push(...(matching.length > 0 ? matching : candidates));
    }
    return selected;
}

export interface EmbeddedFonts {
    css: string;
    /** Web font families the pages use that ended up with no embedded face. */
    fallbackFamilies: string[];
}

/** Fetches and inlines the selected faces; a face that cannot be fetched is dropped. */
export async function embedFontFaces(
    sources: Array<{ faces: FontFaceRule[]; baseUrl: string }>,
    usage: Map<string, FontUsage>,
    fetchImpl: FetchLike = fetch,
): Promise<EmbeddedFonts> {
    const embedded = new Set<string>();
    const known = new Set<string>();
    const chunks: string[] = [];
    for (const { faces, baseUrl } of sources) {
        for (const face of faces) known.add(face.family);
        for (const face of selectFontFaces(faces, usage)) {
            try {
                chunks.push(await inlineCssUrls(keepBestFontSource(face.text), baseUrl, fetchImpl));
                embedded.add(face.family);
            } catch {
                // reported through fallbackFamilies when the family ends up empty
            }
        }
    }
    const fallbackFamilies = Array.from(usage.keys()).filter((family) => known.has(family) && !embedded.has(family));
    return { css: chunks.join("\n"), fallbackFamilies };
}

/** Everything that goes in `<head>` of the exported file. */
export async function buildEmbeddedStyles(
    pageNodes: HTMLElement[],
    options: { doc?: Document; fetchImpl?: FetchLike } = {},
): Promise<{ styles: string; fallbackFamilies: string[] }> {
    const doc = options.doc ?? document;
    const fetchImpl = options.fetchImpl ?? fetch;

    const links = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'));
    const sheets: string[] = [];
    const fontSources: Array<{ faces: FontFaceRule[]; baseUrl: string }> = [];
    for (const link of links) {
        const raw = await readStylesheetText(link, fetchImpl);
        fontSources.push({ faces: parseFontFaces(raw), baseUrl: link.href });
        sheets.push(`<style>${await inlineCssUrls(stripFontFaceRules(raw), link.href, fetchImpl)}</style>`);
    }
    for (const style of Array.from(doc.querySelectorAll<HTMLStyleElement>("style"))) {
        const faces = parseFontFaces(style.textContent ?? "");
        if (faces.length > 0) fontSources.push({ faces, baseUrl: doc.baseURI });
    }

    const fonts = await embedFontFaces(fontSources, collectFontUsage(pageNodes), fetchImpl);
    const fontStyle = fonts.css ? `<style>${fonts.css}</style>` : "";
    return {
        styles: [...sheets, fontStyle, collectDocumentStyles(doc)].filter(Boolean).join("\n"),
        fallbackFamilies: fonts.fallbackFamilies,
    };
}

const CSS_REMOTE_URL = /url\(\s*['"]?\s*(?:https?:|\/\/|\/(?!\/)|blob:)/i;

/**
 * Problems that would make the file depend on a server. An empty list means it
 * is self-contained. Hyperlinks (<a href>) are allowed: they are content.
 */
export function assertSelfContained(html: string): string[] {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const problems: string[] = [];
    if (doc.querySelector("link")) problems.push("contains a <link>");
    if (doc.querySelector("base")) problems.push("contains a <base>");
    if (doc.querySelector("script")) problems.push("contains a <script>");

    const remote = (value: string | null) => !!value && /^\s*(?:https?:|\/\/|\/(?!\/)|blob:)/i.test(value);
    for (const element of Array.from(doc.querySelectorAll("*"))) {
        if (element.tagName.toLowerCase() === "a") continue;
        for (const name of ["src", "srcset", "poster", "data", "href", "xlink:href"]) {
            if (remote(element.getAttribute(name))) problems.push(`<${element.tagName.toLowerCase()} ${name}> points at a server`);
        }
        const inline = element.getAttribute("style");
        if (inline && CSS_REMOTE_URL.test(inline)) problems.push(`<${element.tagName.toLowerCase()}> style points at a server`);
    }
    for (const style of Array.from(doc.querySelectorAll("style"))) {
        const text = style.textContent ?? "";
        if (CSS_REMOTE_URL.test(text)) problems.push("a stylesheet has a url() that points at a server");
        if (/@import/i.test(text)) problems.push("a stylesheet uses @import");
    }
    return problems;
}
