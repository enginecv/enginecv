import { createElement, type FunctionComponent } from "react";
import { createRoot } from "react-dom/client";
import { db } from "@/lib/db";
import { toDocumentModel } from "@/lib/document-model";
import { buildSelfContainedHtmlDocument } from "@/lib/export";
import { toLatex } from "@/lib/export-latex";
import { toMarkdown } from "@/lib/export-markdown";
import { toPlainText } from "@/lib/export-plaintext";
import { toLetterLatex } from "@/lib/letters/export-latex";
import { toLetterMarkdown, toLetterPlainText } from "@/lib/letters/export-text";
import { letterFileBaseName } from "@/lib/letters/file-name";
import { resolveLetter } from "@/lib/letters/resolve";
import { letterDocumentSchema } from "@/lib/letters/schema";
import { loadCv, parseCv } from "@/lib/letters/store";
import { getResumeExportBaseName } from "@/lib/resume-export";
import type { Resume } from "@/lib/schema";
import type { DocKind } from "./types";

/**
 * Makes the file an export request asks for, from the document as the app holds it, with the same
 * exporters the Export dialog uses. Nothing is downloaded: the caller gets the bytes and a name
 * stem. HTML needs real layout, so the document is drawn into an off-screen container, exported from
 * there and removed again; the editor and its preview are never touched.
 */

export interface ProducedExport {
    stem: string;
    extension: string;
    body: string | Uint8Array;
}

export class ExportUnavailableError extends Error {
    constructor(readonly reason: "unknown-document" | "format-unavailable" | "export-failed", message: string) {
        super(message);
    }
}

/** How long an off-screen render may take to settle before the export is given up. */
export const RENDER_TIMEOUT_MS = 10_000;
const SETTLE_POLL_MS = 60;
const STABLE_POLLS = 3;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Draws `element` where nobody sees it, waits until its pages stop changing, and hands the container to `use`. */
async function withOffscreenRender<T>(element: ReturnType<typeof createElement>, width: number, use: (container: HTMLElement) => Promise<T>): Promise<T> {
    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    container.setAttribute("data-workspace-export", "true");
    container.style.cssText = `position:fixed;left:-100000px;top:0;width:${width}px;height:4000px;overflow:hidden;pointer-events:none;`;
    document.body.appendChild(container);
    const root = createRoot(container);
    try {
        root.render(element);
        const started = Date.now();
        let lastSignature = "";
        let stable = 0;
        for (;;) {
            await wait(SETTLE_POLL_MS);
            const pages = container.querySelectorAll(".resume-page");
            const signature = `${pages.length}:${container.innerHTML.length}`;
            stable = pages.length > 0 && signature === lastSignature ? stable + 1 : 0;
            lastSignature = signature;
            if (stable >= STABLE_POLLS) break;
            if (Date.now() - started > RENDER_TIMEOUT_MS) throw new ExportUnavailableError("export-failed", "The document did not finish rendering in time.");
        }
        await document.fonts?.ready;
        return await use(container);
    } finally {
        root.unmount();
        container.remove();
    }
}

/** Bytes of a Blob; older environments (and test DOMs) lack `Blob.arrayBuffer`. */
async function blobBytes(blob: Blob): Promise<Uint8Array> {
    if (typeof blob.arrayBuffer === "function") return await blobBytes(blob);
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
    });
}

async function loadResume(docId: string): Promise<Resume | null> {
    const row = await db.resumes.get(docId);
    return row ? parseCv(row) : null;
}

export async function produceExport(input: { kind: DocKind; docId: string; format: string; paper?: "a4" | "letter" }): Promise<ProducedExport> {
    const { kind, docId, format } = input;

    if (kind === "cv") {
        const resume = await loadResume(docId);
        if (!resume) throw new ExportUnavailableError("unknown-document", "That CV no longer exists in EngineCV.");
        const paper = input.paper ?? "a4";
        const stem = getResumeExportBaseName(resume);
        switch (format) {
            case "json":
                return { stem: `resume-${stem}`, extension: "json", body: `${JSON.stringify(resume, null, 2)}\n` };
            case "md":
                return { stem, extension: "md", body: toMarkdown(toDocumentModel(resume)) };
            case "txt":
                return { stem, extension: "txt", body: toPlainText(toDocumentModel(resume)) };
            case "tex":
                return { stem, extension: "tex", body: toLatex(toDocumentModel(resume), { paperSize: paper }) };
            case "docx": {
                const { buildDocx } = await import("@/lib/export-docx");
                const { blob } = await buildDocx(toDocumentModel(resume), { style: { fontFamily: resume.settings.typography.fontFamily, accent: resume.settings.colors.accent, text: resume.settings.colors.text, paperSize: paper }, includePhoto: false });
                return { stem, extension: "docx", body: await blobBytes(blob) };
            }
            case "html": {
                const { ResumePreview } = await import("@/components/editor/ResumePreview");
                const html = await withOffscreenRender(createElement(ResumePreview as unknown as FunctionComponent<{ resumeOverride: Resume; paperSizeOverride: "a4" | "letter"; thumbnailMode: boolean }>, { resumeOverride: resume, paperSizeOverride: paper, thumbnailMode: true }), paper === "letter" ? 816 : 794, (container) => buildSelfContainedHtmlDocument(paper, `${stem}.html`, container));
                if (!html) throw new ExportUnavailableError("export-failed", "The CV produced no pages.");
                return { stem, extension: "html", body: html.html };
            }
            default:
                throw new ExportUnavailableError("format-unavailable", `A CV cannot be exported as ${format}.`);
        }
    }

    const row = await db.coverLetters.get(docId);
    const parsed = row ? letterDocumentSchema.safeParse(row) : null;
    if (!parsed?.success) throw new ExportUnavailableError("unknown-document", "That letter no longer exists in EngineCV.");
    const letterDoc = parsed.data;
    const cv = letterDoc.status === "draft" ? await loadCv(letterDoc.cvId) : null;
    const resolved = resolveLetter(input.paper ? { ...letterDoc, paperSize: input.paper, layout: letterDoc.layout === "din5008" ? "standard" : letterDoc.layout } : letterDoc, cv);
    const stem = letterFileBaseName(resolved);
    switch (format) {
        case "md":
            return { stem, extension: "md", body: toLetterMarkdown(resolved) };
        case "txt":
            return { stem, extension: "txt", body: toLetterPlainText(resolved) };
        case "tex":
            return { stem, extension: "tex", body: toLetterLatex(resolved) };
        case "docx": {
            const { buildLetterDocx } = await import("@/lib/letters/export-docx");
            const { blob } = await buildLetterDocx(resolved, { includePhoto: false });
            return { stem, extension: "docx", body: await blobBytes(blob) };
        }
        case "html": {
            const { LetterPreview } = await import("@/components/letters/LetterPreview");
            const width = resolved.paperSize === "letter" ? 816 : 794;
            const html = await withOffscreenRender(createElement(LetterPreview, { letter: resolved }), width, (container) => buildSelfContainedHtmlDocument(resolved.paperSize, `${stem}.html`, container));
            if (!html) throw new ExportUnavailableError("export-failed", "The letter produced no pages.");
            return { stem, extension: "html", body: html.html };
        }
        default:
            throw new ExportUnavailableError("format-unavailable", `A letter cannot be exported as ${format}.`);
    }
}
