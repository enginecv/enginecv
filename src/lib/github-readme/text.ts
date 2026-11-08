/**
 * Escaping and shortening helpers for the README export. The inline escape
 * set matches `export-markdown.ts`; kept local so that module's API stays
 * as it is.
 */

const INLINE_ESCAPE = /([\\`*_[\]<>|])/g;

export function escapeInline(value: string): string {
    return value.replace(INLINE_ESCAPE, "\\$1");
}

/** Neutralizes a leading block marker so generated text can't become a list or heading. */
export function escapeLineStart(value: string): string {
    return value
        .replace(/^(\s*)([-+#>])/, "$1\\$2")
        .replace(/^(\s*)(\d+)([.)])/, "$1$2\\$3");
}

export function escapeText(value: string): string {
    return escapeLineStart(escapeInline(value));
}

export function escapeAttr(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

export function escapeXml(value: string): string {
    return escapeAttr(value).replace(/'/g, "&apos;");
}

const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

/**
 * Only http, https and mailto targets survive. Characters that would end a
 * Markdown link target early are percent-encoded.
 */
export function safeUrl(url: string): string | null {
    const trimmed = url.trim();
    if (!trimmed) return null;
    try {
        const parsed = new URL(trimmed);
        if (!SAFE_PROTOCOLS.has(parsed.protocol)) return null;
        return parsed.href.replace(/[()\s<>]/g, (char) => encodeURIComponent(char));
    } catch {
        return null;
    }
}

/** Markdown → plain text: drops links' targets, emphasis, code ticks and list markers. */
export function plainText(markdown: string): string {
    return markdown
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/(\*\*|__)(.*?)\1/g, "$2")
        .replace(/(\*|_)(.*?)\1/g, "$2")
        .replace(/`([^`]*)`/g, "$1")
        .replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm, "")
        .replace(/^\s*#+\s+/gm, "")
        .replace(/\s+/g, " ")
        .trim();
}

/** Cuts at a word boundary when one is close, then appends an ellipsis. */
export function truncate(value: string, max: number): string {
    const chars = Array.from(value);
    if (chars.length <= max) return value;
    const head = chars.slice(0, max - 1).join("");
    const lastSpace = head.lastIndexOf(" ");
    const cut = lastSpace > max * 0.6 ? head.slice(0, lastSpace) : head;
    return `${cut.replace(/[\s.,;:–-]+$/, "")}…`;
}

export function firstParagraph(markdown: string): string {
    return markdown.trim().split(/\n\s*\n/)[0] ?? "";
}
