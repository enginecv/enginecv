import { toPng, toSvg } from "html-to-image";
import { isJsonResumeDocument } from "./agent/authoring/detect";
import { jsonResumeToResume } from "./json-resume/to-resume";
import { MAX_JSON_RESUME_BYTES } from "./json-resume/schema";
import { clampResumeSettings, resumeSchema, type Resume } from "./schema";
import { isDataExport, resumesFromDataExport } from "./storage-registry/export-file";
import type { ZodIssue } from "zod";

// Self-hosted fonts declare woff2 and woff sources; embed only the smaller woff2.
const EMBEDDED_FONT_FORMAT = "woff2";

const ENCRYPTED_JSON_ITERATIONS = 250000;
const ENCRYPTED_JSON_SALT_BYTES = 16;
const ENCRYPTED_JSON_IV_BYTES = 12;

type EncryptedResumeExport = {
    format: "enginecv/encrypted-json";
    version: 1;
    algorithm: "AES-GCM";
    kdf: {
        name: "PBKDF2";
        hash: "SHA-256";
        iterations: number;
        salt: string;
    };
    iv: string;
    ciphertext: string;
};

export type ExportMessages = {
    secureEncryptedExportUnavailable: string;
    secureEncryptedImportUnavailable: string;
    decryptionFailed: string;
    printDialogUnavailable: string;
    encryptionKeyRequired: string;
    resumeReadFailed: string;
    encryptedFileNeedsKey: string;
    decryptedFileInvalidJson: string;
    invalidResumeFile: string;
    importErrorCheckConsole: string;
};

const DEFAULT_EXPORT_MESSAGES: ExportMessages = {
    secureEncryptedExportUnavailable: "Secure encrypted export is not available in this browser.",
    secureEncryptedImportUnavailable: "Secure encrypted import is not available in this browser.",
    decryptionFailed: "The decryption key is incorrect or the encrypted file is corrupted.",
    printDialogUnavailable: "Unable to open the browser print dialog. Please allow pop-ups and try again.",
    encryptionKeyRequired: "Enter an encryption key before exporting.",
    resumeReadFailed: "Could not read the resume file.",
    encryptedFileNeedsKey: "This file is encrypted and needs a decryption key.",
    decryptedFileInvalidJson: "The decrypted file is not valid JSON.",
    invalidResumeFile: "Invalid resume file format.",
    importErrorCheckConsole: "Check the browser console for a detailed import log.",
};

function resolveExportMessages(messages?: Partial<ExportMessages>): ExportMessages {
    return { ...DEFAULT_EXPORT_MESSAGES, ...messages };
}

export class ResumeImportError extends Error {
    readonly details: string;

    constructor(message: string, details: string) {
        super(message);
        this.name = "ResumeImportError";
        this.details = details;
    }
}

export function getResumeImportErrorDetails(error: unknown) {
    return error instanceof ResumeImportError ? error.details : null;
}

function formatSchemaPath(path: ZodIssue["path"]) {
    const formatted = path.reduce<string>((out, part) => {
        if (typeof part === "number") {
            return `${out}[${part}]`;
        }
        return out ? `${out}.${String(part)}` : String(part);
    }, "");

    return formatted || "(root)";
}

function formatSchemaIssues(issues: ZodIssue[]) {
    const sanitizedIssues = issues.map((issue) => ({
        path: formatSchemaPath(issue.path),
        message: issue.message,
        code: issue.code,
    }));

    return {
        sanitizedIssues,
        details: [
            "Resume schema validation failed.",
            ...sanitizedIssues.map((issue, index) =>
                `${index + 1}. ${issue.path}: ${issue.message} (${issue.code})`
            ),
        ].join("\n"),
    };
}

function withConsoleHint(message: string, exportMessages: ExportMessages) {
    return `${message} ${exportMessages.importErrorCheckConsole}`;
}

function serializeResumeJson(data: unknown) {
    return JSON.stringify(data, null, 2);
}

export function exportToJson(data: unknown, filename: string = "resume.json") {
    const blob = new Blob([serializeResumeJson(data)], { type: "application/json" });
    downloadBlob(blob, filename);
}

function getPageNodes() {
    const nodes = document.querySelectorAll<HTMLElement>(".resume-page");
    if (nodes.length === 0) {
        console.error("No .resume-page elements found for export.");
    }
    return nodes;
}

/** True when the preview has rendered at least one page to export from. */
export function hasPreviewPages(): boolean {
    return typeof document !== "undefined" && document.querySelector(".resume-page") !== null;
}

/**
 * Resolves once a preview page is in the DOM, or false after the timeout. On a
 * phone the preview pane mounts only when shown, so callers switch to it first.
 */
export function waitForPreviewPages(timeoutMs = 5_000): Promise<boolean> {
    if (hasPreviewPages()) return Promise.resolve(true);
    return new Promise((resolve) => {
        const deadline = Date.now() + timeoutMs;
        const check = () => {
            if (hasPreviewPages()) resolve(true);
            else if (Date.now() >= deadline) resolve(false);
            else setTimeout(check, 50);
        };
        check();
    });
}

function filterIndicators(element: Element) {
    return !(element instanceof HTMLElement && element.dataset.pageBreakIndicator);
}

// ResumePreview scopes its CSS to a dynamic per-instance class on an ancestor
// of .resume-page (e.g. ".resume-preview-scope-r1 .resume-document"). Export
// clones only the .resume-page node, so the scope ancestor is lost and the
// scoped rules stop matching. Copy the scope class onto the clone so they do.
function getResumeScopeClass(pageNode: HTMLElement) {
    const scopedAncestor = pageNode.closest<HTMLElement>('[class*="resume-preview-scope-"]');
    if (!scopedAncestor) return null;
    return Array.from(scopedAncestor.classList).find((cls) => cls.startsWith("resume-preview-scope-")) ?? null;
}

/**
 * How long a download's object URL stays valid. Android Chrome hands the URL
 * to its download manager, which fetches it after the click handler returns;
 * revoking at once made every download fail there ("Download failed").
 */
const DOWNLOAD_URL_LIFETIME_MS = 60_000;

export function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_LIFETIME_MS);
}

function downloadDataUrl(dataUrl: string, filename: string) {
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
}

function bytesToBase64(bytes: Uint8Array) {
    let binary = "";
    const chunkSize = 0x8000;

    for (let index = 0; index < bytes.length; index += chunkSize) {
        const chunk = bytes.subarray(index, index + chunkSize);
        binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
}

function base64ToBytes(value: string) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
}

function toBufferSource(bytes: Uint8Array) {
    const normalized = new Uint8Array(bytes.byteLength);
    normalized.set(bytes);
    return normalized;
}

/** The password-protected envelope for any JSON value: a resume, or a full data export (076). */
export async function createEncryptedJsonExport(
    data: unknown,
    encryptionKey: string,
    messages?: Partial<ExportMessages>
) {
    const exportMessages = resolveExportMessages(messages);

    if (!window.crypto?.getRandomValues || !window.crypto?.subtle) {
        throw new Error(exportMessages.secureEncryptedExportUnavailable);
    }

    if (!encryptionKey.trim()) {
        throw new Error(exportMessages.encryptionKeyRequired);
    }

    const salt = new Uint8Array(ENCRYPTED_JSON_SALT_BYTES);
    window.crypto.getRandomValues(salt);

    const iv = new Uint8Array(ENCRYPTED_JSON_IV_BYTES);
    window.crypto.getRandomValues(iv);

    const key = await deriveEncryptedJsonKey(encryptionKey, salt, exportMessages);
    const plaintext = toBufferSource(new TextEncoder().encode(JSON.stringify(data)));
    const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: toBufferSource(iv) },
        key,
        plaintext
    );

    return {
        format: "enginecv/encrypted-json",
        version: 1,
        algorithm: "AES-GCM",
        kdf: {
            name: "PBKDF2",
            hash: "SHA-256",
            iterations: ENCRYPTED_JSON_ITERATIONS,
            salt: bytesToBase64(salt),
        },
        iv: bytesToBase64(iv),
        ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    } satisfies EncryptedResumeExport;
}

function isEncryptedResumeExport(value: unknown): value is EncryptedResumeExport {
    if (!value || typeof value !== "object") {
        return false;
    }

    const payload = value as Partial<EncryptedResumeExport>;
    return (
        payload.format === "enginecv/encrypted-json" &&
        payload.algorithm === "AES-GCM" &&
        payload.version === 1 &&
        typeof payload.iv === "string" &&
        typeof payload.ciphertext === "string" &&
        !!payload.kdf &&
        payload.kdf.name === "PBKDF2" &&
        payload.kdf.hash === "SHA-256" &&
        typeof payload.kdf.salt === "string" &&
        typeof payload.kdf.iterations === "number"
    );
}

async function deriveEncryptedJsonKey(passphrase: string, salt: Uint8Array, messages: ExportMessages) {
    const subtle = window.crypto?.subtle;
    if (!subtle) {
        throw new Error(messages.secureEncryptedExportUnavailable);
    }

    const keyMaterial = await subtle.importKey(
        "raw",
        toBufferSource(new TextEncoder().encode(passphrase)),
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    return subtle.deriveKey(
        {
            name: "PBKDF2",
            hash: "SHA-256",
            salt: toBufferSource(salt),
            iterations: ENCRYPTED_JSON_ITERATIONS,
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
    );
}

async function deriveImportedEncryptedJsonKey(payload: EncryptedResumeExport, passphrase: string, messages: ExportMessages) {
    const subtle = window.crypto?.subtle;
    if (!subtle) {
        throw new Error(messages.secureEncryptedImportUnavailable);
    }

    const keyMaterial = await subtle.importKey(
        "raw",
        toBufferSource(new TextEncoder().encode(passphrase)),
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    return subtle.deriveKey(
        {
            name: "PBKDF2",
            hash: payload.kdf.hash,
            salt: toBufferSource(base64ToBytes(payload.kdf.salt)),
            iterations: payload.kdf.iterations,
        },
        keyMaterial,
        { name: payload.algorithm, length: 256 },
        false,
        ["decrypt"]
    );
}

async function decryptImportedResume(payload: EncryptedResumeExport, passphrase: string, messages: ExportMessages) {
    try {
        const subtle = window.crypto?.subtle;
        if (!subtle) {
            throw new Error(messages.secureEncryptedImportUnavailable);
        }

        const key = await deriveImportedEncryptedJsonKey(payload, passphrase, messages);
        const plaintext = await subtle.decrypt(
            { name: payload.algorithm, iv: toBufferSource(base64ToBytes(payload.iv)) },
            key,
            toBufferSource(base64ToBytes(payload.ciphertext))
        );

        return new TextDecoder().decode(plaintext);
    } catch (error) {
        if (error instanceof Error && error.message === messages.secureEncryptedImportUnavailable) {
            throw error;
        }

        throw new Error(messages.decryptionFailed);
    }
}

function decodeSvgDataUrl(dataUrl: string) {
    const parts = dataUrl.split(",", 2);
    if (parts.length !== 2) {
        throw new Error("Invalid SVG data URL.");
    }

    const [, payload] = parts;
    if (dataUrl.includes(";base64,")) {
        return atob(payload);
    }

    return decodeURIComponent(payload);
}

function parseSvgSize(value: string | null, fallback: number) {
    if (!value) return fallback;

    const numericValue = Number.parseFloat(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

function getSvgDimensions(svgElement: SVGSVGElement, fallbackWidth: number, fallbackHeight: number) {
    const viewBox = svgElement.getAttribute("viewBox");
    if (viewBox) {
        const [, , width, height] = viewBox.split(/[\s,]+/).map((value) => Number.parseFloat(value));
        if (Number.isFinite(width) && Number.isFinite(height)) {
            return { width, height };
        }
    }

    return {
        width: parseSvgSize(svgElement.getAttribute("width"), fallbackWidth),
        height: parseSvgSize(svgElement.getAttribute("height"), fallbackHeight),
    };
}

function combineSvgPages(svgPages: Array<{ markup: string; width: number; height: number }>) {
    const parser = new DOMParser();
    const serializer = new XMLSerializer();
    const svgDocument = document.implementation.createDocument("http://www.w3.org/2000/svg", "svg", null);
    const combinedSvg = svgDocument.documentElement;

    combinedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    combinedSvg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

    const totalHeight = svgPages.reduce((sum, page) => sum + page.height, 0);
    const maxWidth = svgPages.reduce((max, page) => Math.max(max, page.width), 0);

    combinedSvg.setAttribute("width", `${maxWidth}`);
    combinedSvg.setAttribute("height", `${totalHeight}`);
    combinedSvg.setAttribute("viewBox", `0 0 ${maxWidth} ${totalHeight}`);

    let offsetY = 0;

    svgPages.forEach((page) => {
        const pageDocument = parser.parseFromString(page.markup, "image/svg+xml");
        const pageSvg = svgDocument.importNode(pageDocument.documentElement, true) as unknown as SVGSVGElement;

        pageSvg.setAttribute("x", "0");
        pageSvg.setAttribute("y", `${offsetY}`);
        pageSvg.setAttribute("width", `${page.width}`);
        pageSvg.setAttribute("height", `${page.height}`);
        pageSvg.setAttribute("viewBox", pageSvg.getAttribute("viewBox") ?? `0 0 ${page.width} ${page.height}`);
        pageSvg.setAttribute("preserveAspectRatio", "xMinYMin meet");

        combinedSvg.appendChild(pageSvg);
        offsetY += page.height;
    });

    return serializer.serializeToString(svgDocument);
}

async function captureUnscaledPage<T>(
    pageNode: HTMLElement,
    capture: (node: HTMLElement, width: number, height: number) => Promise<T>
) {
    const exportContainer = document.createElement("div");
    const exportNode = pageNode.cloneNode(true) as HTMLElement;
    const { width, height } = getIntrinsicPageSize(pageNode);

    const scopeClass = getResumeScopeClass(pageNode);
    if (scopeClass) {
        exportNode.classList.add(scopeClass);
    }

    exportContainer.style.position = "fixed";
    exportContainer.style.left = "-10000px";
    exportContainer.style.top = "0";
    exportContainer.style.visibility = "hidden";
    exportContainer.style.pointerEvents = "none";
    exportContainer.style.overflow = "hidden";
    exportContainer.style.background = "#ffffff";

    // The preview's hover outline is :hover-only, but guard against a hovered
    // element leaking into the captured image by forcing it off on the clone.
    const outlineReset = document.createElement("style");
    outlineReset.textContent = "[data-nav-section]{outline:none !important;}";
    exportContainer.appendChild(outlineReset);

    exportNode.style.transform = "none";
    exportNode.style.transformOrigin = "top left";
    exportNode.style.zoom = "1";
    exportNode.style.margin = "0";
    exportNode.style.marginBottom = "0";
    exportNode.style.boxShadow = "none";
    exportNode.style.width = `${width}px`;
    exportNode.style.height = `${height}px`;
    exportNode.style.minHeight = `${height}px`;
    exportNode.style.maxHeight = `${height}px`;
    exportNode.style.overflow = "hidden";

    exportContainer.appendChild(exportNode);
    document.body.appendChild(exportContainer);

    try {
        return await capture(exportNode, width, height);
    } finally {
        document.body.removeChild(exportContainer);
    }
}

async function captureUnscaledPageSvg(pageNode: HTMLElement) {
    return captureUnscaledPage(pageNode, (node, width, height) =>
        toSvg(node, {
            width,
            height,
            pixelRatio: 1,
            filter: filterIndicators,
            preferredFontFormat: EMBEDDED_FONT_FORMAT,
        })
    );
}

async function captureUnscaledPagePng(pageNode: HTMLElement) {
    return captureUnscaledPage(pageNode, async (node, width, height) => {
        const dataUrl = await toPng(node, {
            width,
            height,
            pixelRatio: 3,
            filter: filterIndicators,
            preferredFontFormat: EMBEDDED_FONT_FORMAT,
        });
        return { dataUrl, width, height };
    });
}

function getPrintableStyles() {
    const stylesheetLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
        .map((link) => `<link rel="stylesheet" href="${link.href}">`)
        .join("\n");

    const inlineStyles = Array.from(document.querySelectorAll<HTMLStyleElement>("style"))
        .map((style) => `<style>${style.textContent ?? ""}</style>`)
        .join("\n");

    return `${stylesheetLinks}\n${inlineStyles}`;
}

function buildPrintableDocument({
    filename,
    paperSize,
    printablePagesMarkup,
    pageWidthPx,
    pageHeightPx,
}: {
    filename: string;
    paperSize: "a4" | "letter";
    printablePagesMarkup: string;
    pageWidthPx: number;
    pageHeightPx: number;
}) {
    const pageLabel = paperSize === "a4" ? "A4" : "letter";

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <base href="${window.location.href}">
    <title>${filename}</title>
    ${getPrintableStyles()}
    <style>
        html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
        }

        body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        /* Resume text stays selectable in the printed/exported PDF. */
        .resume-document, .resume-document * {
            -webkit-user-select: text;
            user-select: text;
        }

        /* Paint containment makes Chrome rasterize text on print — force it off
           so the whole page prints as real, selectable text. */
        .print-exact-page-wrapper,
        .print-exact-page-wrapper * {
            contain: none !important;
            content-visibility: visible !important;
        }

        /* Any compositing/GPU-layer trigger on an ancestor of the text makes
           interactive "Save as PDF" rasterize the whole page (killing text
           selection AND link annotations). Neutralise them on the page and
           document wrappers. Scoped to ancestors so per-element effects (a
           rotated design shape, a filtered photo) still render. */
        .print-exact-page-wrapper,
        .print-exact-page-wrapper .resume-document {
            will-change: auto !important;
            transform: none !important;
            filter: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            perspective: none !important;
            isolation: auto !important;
            mix-blend-mode: normal !important;
            opacity: 1 !important;
            mask: none !important;
            clip-path: none !important;
        }

        /* The preview's interactive hover outline must never render here. */
        [data-nav-section]:hover {
            outline: none !important;
        }

        .print-exact-scroll-wrapper {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0 !important;
            padding: 0;
            background: #ffffff;
        }

        .print-exact-page-wrapper {
            box-shadow: none !important;
            break-after: page;
            page-break-after: always;
        }

        .print-exact-page-wrapper:last-child {
            break-after: auto;
            page-break-after: auto;
        }

        @media print {
            @page {
                size: ${pageLabel};
                margin: 0;
            }

            .print-exact-scroll-wrapper {
                transform: none !important;
                margin: 0 !important;
                padding: 0 !important;
                gap: 0 !important;
            }

            /* Override the app's @media print rules that force 100% sizing.
               Use the preview's exact intrinsic px so typography matches 1:1. */
            .print-exact-page-wrapper {
                transform: none !important;
                zoom: 1 !important;
                margin: 0 !important;
                box-shadow: none !important;
                width: ${pageWidthPx}px !important;
                height: ${pageHeightPx}px !important;
                min-height: ${pageHeightPx}px !important;
                max-height: ${pageHeightPx}px !important;
                overflow: hidden !important;
            }

            .print-exact-page-wrapper .resume-document {
                width: 100% !important;
                height: 100% !important;
                min-height: 100% !important;
                max-height: 100% !important;
                margin: 0 !important;
                box-shadow: none !important;
                background-color: white !important;
                overflow: hidden !important;
            }

            section, .print-exact-page-wrapper .resume-document > div {
                break-inside: avoid;
                page-break-inside: avoid;
            }

            .heading-style {
                break-after: avoid;
                page-break-after: avoid;
            }
        }
    </style>
</head>
<body>
    <div class="print-exact-scroll-wrapper">${printablePagesMarkup}</div>
</body>
</html>`;
}

function getIntrinsicPageSize(pageNode: HTMLElement) {
    const styleWidth = parseFloat(pageNode.style.width);
    const styleHeight = parseFloat(pageNode.style.height);
    const width = Number.isFinite(styleWidth) && styleWidth > 0 ? styleWidth : pageNode.offsetWidth;
    const height = Number.isFinite(styleHeight) && styleHeight > 0 ? styleHeight : pageNode.offsetHeight;
    return { width, height };
}

/** Multiplies a computed `rgb()`/`rgba()` colour by an alpha, or null if unparseable. */
function colorWithAlpha(color: string, alpha: number): string | null {
    const match = /^rgba?\(([^)]+)\)$/.exec(color.trim());
    if (!match) return null;

    const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.slice(0, 3).some((part) => !Number.isFinite(part))) return null;

    const existing = parts.length > 3 && Number.isFinite(parts[3]) ? parts[3] : 1;
    const [red, green, blue] = parts;
    return `rgba(${red}, ${green}, ${blue}, ${Number((existing * alpha).toFixed(3))})`;
}

/** True when the element paints anything besides text, so dimming it needs `opacity`. */
function paintsMoreThanText(node: Element, style: CSSStyleDeclaration): boolean {
    const painted = (value: string) => value !== "" && value !== "none" && value !== "transparent" && value !== "rgba(0, 0, 0, 0)";

    if (["IMG", "SVG", "CANVAS", "VIDEO", "PICTURE", "IFRAME"].includes(node.tagName.toUpperCase())) return true;
    if (painted(style.backgroundImage) || painted(style.backgroundColor) || painted(style.boxShadow)) return true;

    return (["top", "right", "bottom", "left"] as const).some((side) => {
        const width = parseFloat(style.getPropertyValue(`border-${side}-width`));
        const borderStyle = style.getPropertyValue(`border-${side}-style`);
        return width > 0 && borderStyle !== "none" && borderStyle !== "";
    });
}

/**
 * Replaces `opacity` on text-only elements with an equally faded text colour.
 *
 * `opacity` makes an element a stacking context, and stacking contexts are
 * painted after the in-flow content around them. In a printed PDF that reorders
 * the text stream: a headline at 80% opacity ends up after the sections below
 * it, which is the order a CV parser reads. A translucent colour looks the same
 * on text but leaves it in flow.
 *
 * Elements that paint a background, border or image keep their `opacity`, since
 * only `opacity` fades those.
 */
function paintsOnlyText(node: Element): boolean {
    if (paintsMoreThanText(node, window.getComputedStyle(node))) return false;
    return Array.from(node.children).every(paintsOnlyText);
}

/** Fades a whole subtree through its text colour, leaving every element in flow. */
function fadeSubtree(source: Element, clone: HTMLElement, alpha: number) {
    const style = window.getComputedStyle(source);
    const own = Number.parseFloat(style.opacity);
    const combined = alpha * (Number.isFinite(own) ? own : 1);

    const faded = colorWithAlpha(style.color, combined);
    if (faded) clone.style.color = faded;
    if (Number.isFinite(own) && own < 1) clone.style.opacity = "1";

    const cloneChildren = Array.from(clone.children) as HTMLElement[];
    for (const [index, child] of Array.from(source.children).entries()) {
        const cloneChild = cloneChildren[index];
        if (cloneChild) fadeSubtree(child, cloneChild, combined);
    }
}

function flattenTextOpacity(source: Element, clone: HTMLElement) {
    const own = Number.parseFloat(window.getComputedStyle(source).opacity);
    if (Number.isFinite(own) && own < 1 && paintsOnlyText(source)) {
        fadeSubtree(source, clone, 1);
        return;
    }

    const cloneChildren = Array.from(clone.children) as HTMLElement[];
    for (const [index, child] of Array.from(source.children).entries()) {
        const cloneChild = cloneChildren[index];
        if (cloneChild) flattenTextOpacity(child, cloneChild);
    }
}

function preparePageForPrint(pageNode: HTMLElement) {
    const clone = pageNode.cloneNode(true) as HTMLElement;
    const { width, height } = getIntrinsicPageSize(pageNode);
    flattenTextOpacity(pageNode, clone);
    clone.classList.add("print-exact-page-wrapper");
    const scopeClass = getResumeScopeClass(pageNode);
    if (scopeClass) {
        clone.classList.add(scopeClass);
    }
    clone.style.transform = "none";
    clone.style.transformOrigin = "top left";
    clone.style.zoom = "1";
    clone.style.margin = "0";
    clone.style.marginBottom = "0";
    clone.style.boxShadow = "none";
    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    clone.style.minHeight = `${height}px`;
    clone.style.maxHeight = `${height}px`;
    clone.style.overflow = "hidden";
    clone.style.backgroundColor = "#ffffff";
    // The preview page sets `contain: strict` (paint containment) for perf. Chrome
    // rasterizes paint-contained subtrees when printing, which turns the resume
    // text into an image (non-selectable in the PDF). Drop it for print.
    clone.style.contain = "none";
    clone.style.breakInside = "avoid";
    clone.style.pageBreakInside = "avoid";
    return clone;
}

export const __testing = {
    getIntrinsicPageSize,
    preparePageForPrint,
};

function waitForPrintAssets(printWindow: Window, printDocument: Document) {
    const stylesheetReady = Promise.all(
        Array.from(printDocument.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map((link) => {
            if ((link.sheet as CSSStyleSheet | null) || link.dataset.loaded === "true") {
                return Promise.resolve();
            }

            return new Promise<void>((resolve) => {
                link.addEventListener("load", () => {
                    link.dataset.loaded = "true";
                    resolve();
                }, { once: true });
                link.addEventListener("error", () => resolve(), { once: true });
            });
        })
    );

    const fontReady = "fonts" in printDocument
        ? (printDocument.fonts.ready as Promise<unknown>).catch(() => undefined)
        : Promise.resolve();

    const imageReady = Promise.all(
        Array.from(printDocument.images).map((image) => {
            if (image.complete) {
                return Promise.resolve();
            }

            return new Promise<void>((resolve) => {
                image.addEventListener("load", () => resolve(), { once: true });
                image.addEventListener("error", () => resolve(), { once: true });
            });
        })
    );

    const layoutReady = new Promise<void>((resolve) => {
        printWindow.requestAnimationFrame(() => {
            printWindow.requestAnimationFrame(() => resolve());
        });
    });

    return Promise.all([stylesheetReady, fontReady, imageReady, layoutReady]).then(() =>
        new Promise<void>((resolve) => window.setTimeout(resolve, 150))
    );
}

async function printResumePreview(
    paperSize: "a4" | "letter",
    filename: string,
    messages: ExportMessages
) {
    const pageNodes = getPageNodes();
    if (pageNodes.length === 0) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
        throw new Error(messages.printDialogUnavailable);
    }

    const printDocument = printWindow.document;
    const { width: pageWidthPx, height: pageHeightPx } = getIntrinsicPageSize(pageNodes[0]);
    const printablePagesMarkup = Array.from(pageNodes)
        .map((pageNode) => preparePageForPrint(pageNode).outerHTML)
        .join("\n");

    printDocument.open();
    printDocument.write(buildPrintableDocument({ filename, paperSize, printablePagesMarkup, pageWidthPx, pageHeightPx }));
    printDocument.close();

    await waitForPrintAssets(printWindow, printDocument);

    printWindow.addEventListener("afterprint", () => {
        if (!printWindow.closed) {
            printWindow.close();
        }
    }, { once: true });

    printWindow.focus();
    printWindow.print();
}

export async function triggerPdfPrint(
    paperSize: "a4" | "letter" = "a4",
    filename: string = "resume.pdf",
    messages?: Partial<ExportMessages>
) {
    const exportMessages = resolveExportMessages(messages);
    await printResumePreview(paperSize, filename, exportMessages);
}

export async function exportToPng(filename: string = "resume.png") {
    const pageNodes = getPageNodes();
    if (pageNodes.length === 0) return;

    if (pageNodes.length === 1) {
        const { dataUrl } = await captureUnscaledPagePng(pageNodes[0]);
        downloadDataUrl(dataUrl, filename);
        return;
    }

    const images: HTMLImageElement[] = [];
    let totalHeight = 0;
    let maxWidth = 0;

    for (const node of pageNodes) {
        const { dataUrl } = await captureUnscaledPagePng(node);
        const image = await loadImage(dataUrl);
        images.push(image);
        totalHeight += image.height;
        maxWidth = Math.max(maxWidth, image.width);
    }

    const canvas = document.createElement("canvas");
    canvas.width = maxWidth;
    canvas.height = totalHeight;
    const context = canvas.getContext("2d");
    if (!context) return;

    let offsetY = 0;
    for (const image of images) {
        context.drawImage(image, 0, offsetY);
        offsetY += image.height;
    }

    canvas.toBlob((blob) => {
        if (blob) {
            downloadBlob(blob, filename);
        }
    }, "image/png");
}

/** Standalone HTML document of the rendered preview pages, or null when no pages are mounted. */
export function buildResumeHtmlDocument(
    paperSize: "a4" | "letter" = "a4",
    filename: string = "resume.html"
): string | null {
    const pageNodes = getPageNodes();
    if (pageNodes.length === 0) return null;

    const { width: pageWidthPx, height: pageHeightPx } = getIntrinsicPageSize(pageNodes[0]);
    const printablePagesMarkup = Array.from(pageNodes)
        .map((pageNode) => preparePageForPrint(pageNode).outerHTML)
        .join("\n");

    return buildPrintableDocument({ filename, paperSize, printablePagesMarkup, pageWidthPx, pageHeightPx });
}

export async function exportToHtml(
    paperSize: "a4" | "letter" = "a4",
    filename: string = "resume.html"
) {
    const html = buildResumeHtmlDocument(paperSize, filename);
    if (html === null) return;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    downloadBlob(blob, filename);
}

export async function exportToEncryptedJson(
    data: Resume,
    encryptionKey: string,
    filename: string = "resume.encrypted.json",
    messages?: Partial<ExportMessages>
) {
    const encryptedExport = await createEncryptedJsonExport(data, encryptionKey, messages);
    const blob = new Blob([serializeResumeJson(encryptedExport)], { type: "application/json" });
    downloadBlob(blob, filename);
}

export async function importResumeFromJsonText(
    rawText: string,
    requestDecryptionKey?: (errorMessage?: string | null) => Promise<string | null> | string | null,
    messages?: Partial<ExportMessages>
) {
    const exportMessages = resolveExportMessages(messages);
    let parsedJson: unknown;

    try {
        parsedJson = JSON.parse(rawText);
    } catch (error) {
        const details = error instanceof Error
            ? `JSON parse failed: ${error.message}`
            : "JSON parse failed.";
        console.error("[EngineCV] Resume import JSON parse failed.", { details });
        throw new ResumeImportError(withConsoleHint(exportMessages.resumeReadFailed, exportMessages), details);
    }

    if (isEncryptedResumeExport(parsedJson)) {
        if (!requestDecryptionKey) {
            throw new Error(exportMessages.encryptedFileNeedsKey);
        }

        let decryptedText: string | null = null;
        let requestError: string | null = null;

        while (decryptedText === null) {
            const decryptionKey = await requestDecryptionKey(requestError);
            if (!decryptionKey) {
                return null;
            }

            try {
                decryptedText = await decryptImportedResume(parsedJson, decryptionKey, exportMessages);
            } catch (error) {
                requestError = error instanceof Error
                    ? error.message
                    : exportMessages.decryptionFailed;
            }
        }

        try {
            parsedJson = JSON.parse(decryptedText);
        } catch (error) {
            const details = error instanceof Error
                ? `Decrypted JSON parse failed: ${error.message}`
                : "Decrypted JSON parse failed.";
            console.error("[EngineCV] Resume import decrypted JSON parse failed.", { details });
            throw new ResumeImportError(withConsoleHint(exportMessages.decryptedFileInvalidJson, exportMessages), details);
        }
    }

    // A "Download my data" file holds several CVs. Without this check the
    // resume schema would turn it into one empty CV (every field has a default).
    if (isDataExport(parsedJson)) {
        const resumes = resumesFromDataExport(parsedJson)
            .map((candidate) => resumeSchema.safeParse(candidate))
            .flatMap((result) => (result.success ? [result.data] : []));
        return {
            kind: "data-export" as const,
            resumes,
            skipped: resumesFromDataExport(parsedJson).length - resumes.length,
        };
    }

    // A jsonresume.org file: converted, with a report of what did not carry over.
    if (isJsonResumeDocument(parsedJson)) {
        if (rawText.length > MAX_JSON_RESUME_BYTES) {
            throw new ResumeImportError(
                withConsoleHint(exportMessages.resumeReadFailed, exportMessages),
                "JSON Resume file is larger than the allowed size.",
            );
        }
        const converted = jsonResumeToResume(parsedJson);
        return {
            kind: "json-resume" as const,
            resume: converted.resume,
            report: converted.report,
            clampedFields: [] as string[],
        };
    }

    const parsed = resumeSchema.safeParse(parsedJson);
    if (!parsed.success) {
        const { sanitizedIssues, details } = formatSchemaIssues(parsed.error.issues);
        console.error("[EngineCV] Resume import schema validation failed.", {
            issues: sanitizedIssues,
        });
        throw new ResumeImportError(withConsoleHint(exportMessages.invalidResumeFile, exportMessages), details);
    }

    const clampedFields = clampResumeSettings(parsed.data);

    return { kind: "resume" as const, resume: parsed.data, clampedFields };
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = src;
    });
}

export async function exportToSvg(filename: string = "resume.svg") {
    const pageNodes = getPageNodes();
    if (pageNodes.length === 0) return;

    const svgPages = await Promise.all(
        Array.from(pageNodes).map(async (pageNode) => {
            const svgDataUrl = await captureUnscaledPageSvg(pageNode);

            const markup = decodeSvgDataUrl(svgDataUrl);
            const parsedSvg = new DOMParser().parseFromString(markup, "image/svg+xml").documentElement as unknown as SVGSVGElement;
            const { width, height } = getSvgDimensions(parsedSvg, pageNode.offsetWidth, pageNode.offsetHeight);

            return { markup, width, height };
        })
    );

    const svgText = combineSvgPages(svgPages);
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    downloadBlob(blob, filename);
}
