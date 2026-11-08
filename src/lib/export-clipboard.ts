import type { DocumentModel } from "./document-model";
import { toHtmlFragment } from "./export-html-fragment";
import { toPlainText } from "./export-plaintext";

export type ClipboardResult = "rich" | "plain";

/** The browser refused clipboard access (permission denied or no user gesture). */
export class ClipboardDeniedError extends Error {
    constructor(cause?: unknown) {
        super("Clipboard access denied");
        this.name = "ClipboardDeniedError";
        this.cause = cause;
    }
}

function isPermissionError(error: unknown): boolean {
    return error instanceof Error && (error.name === "NotAllowedError" || error.name === "SecurityError");
}

/**
 * Copies the resume as rich HTML plus plain text, falling back to plain text
 * where `ClipboardItem` is missing or rejects. Both payloads are serialized
 * before the first await: Safari drops the user gesture across async gaps.
 */
export async function copyResumeToClipboard(model: DocumentModel, accentColor?: string): Promise<ClipboardResult> {
    const plain = toPlainText(model);
    const html = toHtmlFragment(model, accentColor);
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;

    if (!clipboard) throw new ClipboardDeniedError();

    if (typeof ClipboardItem !== "undefined" && typeof clipboard.write === "function") {
        try {
            await clipboard.write([
                new ClipboardItem({
                    "text/html": new Blob([html], { type: "text/html" }),
                    "text/plain": new Blob([plain], { type: "text/plain" }),
                }),
            ]);
            return "rich";
        } catch (error) {
            if (isPermissionError(error)) throw new ClipboardDeniedError(error);
            // Some engines reject mixed payloads; plain text still helps.
        }
    }

    try {
        await clipboard.writeText(plain);
        return "plain";
    } catch (error) {
        throw new ClipboardDeniedError(error);
    }
}

/** Copies an already serialized payload (plain text or Markdown source) as `text/plain` only. */
export async function copyTextToClipboard(text: string): Promise<void> {
    const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    if (!clipboard) throw new ClipboardDeniedError();

    try {
        await clipboard.writeText(text);
    } catch (error) {
        throw new ClipboardDeniedError(error);
    }
}
