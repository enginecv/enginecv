// Lines that start a Markdown block: list items, quotes, headings, fences.
const BLOCK_START = /^\s*(?:[-*+]\s|\d+[.)]\s|>|#{1,6}\s|```)/;

/**
 * Keeps single line breaks visible when plain text is rendered as Markdown.
 * The summary was shown with `white-space: pre-wrap` before it became
 * Markdown, so summaries written as separate lines must not merge into one
 * paragraph. Blank lines, list items and other block starts are untouched.
 */
export function preserveLineBreaks(markdown: string): string {
    const lines = markdown.split("\n");
    return lines
        .map((line, index) => {
            const next = lines[index + 1];
            const breaks = next !== undefined
                && line.trim() !== ""
                && next.trim() !== ""
                && !BLOCK_START.test(next)
                && !BLOCK_START.test(line)
                && !line.endsWith("  ")
                && !line.endsWith("\\");
            return breaks ? `${line}  ` : line;
        })
        .join("\n");
}

/**
 * The inverse for text coming back from the inline editor, which writes hard
 * breaks as a trailing backslash: store them as the plain line breaks the
 * sidebar field writes, so both editors produce the same text.
 */
export function fromHardBreaks(markdown: string): string {
    return markdown.replace(/(?:\\| {2,})\n/g, "\n");
}
