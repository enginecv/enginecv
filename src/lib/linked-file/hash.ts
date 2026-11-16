/** Normalised so a trailing newline or CRLF from another editor is not a change. */
function normalizeText(text: string): string {
    return text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\n+$/g, "");
}

/** FNV-1a (32-bit) over the normalised text, plus its length; fast and stable, not cryptographic. */
export function hashText(text: string): string {
    const normalized = normalizeText(text);
    let hash = 0x811c9dc5;
    for (let i = 0; i < normalized.length; i += 1) {
        hash ^= normalized.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return `${(hash >>> 0).toString(16)}:${normalized.length}`;
}
