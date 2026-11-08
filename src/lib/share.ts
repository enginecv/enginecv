import { downloadBlob } from "./export";

/**
 * File delivery for generated exports.
 *
 * Anchor downloads are the default everywhere. iOS Safari/WebKit is the one
 * platform where a Blob anchor download is unreliable (the file often opens in
 * place with no way to save it), so there the Web Share sheet is used instead
 * and the user picks "Save to Files".
 */

export type FileDeliveryMethod = "share" | "download";

function isIosWebKit(): boolean {
    if (typeof navigator === "undefined") return false;

    const userAgent = navigator.userAgent || "";
    const isIosDevice = /\b(iPhone|iPad|iPod)\b/.test(userAgent);
    // iPadOS reports a desktop UA; touch points separate it from a real Mac.
    const isIpadOs = /\bMacintosh\b/.test(userAgent) && navigator.maxTouchPoints > 1;

    return isIosDevice || isIpadOs;
}

function canShareFile(file: File): boolean {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
    return navigator.canShare?.({ files: [file] }) === true;
}

/** True when a user gesture ended the share sheet — not an error worth retrying. */
function isShareAbort(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError";
}

export async function deliverFile(
    blob: Blob,
    filename: string,
    options: { title?: string } = {},
): Promise<FileDeliveryMethod> {
    if (typeof File === "function" && isIosWebKit()) {
        const file = new File([blob], filename, { type: blob.type });

        if (canShareFile(file)) {
            try {
                await navigator.share({ files: [file], title: options.title ?? filename });
                return "share";
            } catch (error) {
                if (isShareAbort(error)) return "share";
                // Any other share failure falls back to the download path.
            }
        }
    }

    downloadBlob(blob, filename);
    return "download";
}
