export type MarkdownListKind = "bullet" | "ordered";

export type MarkdownListToggleResult = {
    text: string;
    selection: { start: number; end: number };
};

const BULLET_PREFIX = /^(\s*)[-*+]\s+/;
const ORDERED_PREFIX = /^(\s*)\d+[.)]\s+/;

/** Toggle list formatting across complete selected lines without stacking markers. */
export function toggleMarkdownList(
    text: string,
    selection: { start: number; end: number },
    kind: MarkdownListKind,
): MarkdownListToggleResult {
    const lineStart = text.lastIndexOf("\n", Math.max(0, selection.start - 1)) + 1;
    const nextBreak = text.indexOf("\n", selection.end);
    const lineEnd = nextBreak === -1 ? text.length : nextBreak;
    const selectedLines = text.slice(lineStart, lineEnd).split("\n");
    const targetPrefix = kind === "bullet" ? BULLET_PREFIX : ORDERED_PREFIX;
    const nonEmptyLines = selectedLines.filter((line) => line.trim().length > 0);
    const removing = nonEmptyLines.length > 0 && nonEmptyLines.every((line) => targetPrefix.test(line));
    let orderedIndex = 0;

    const nextLines = selectedLines.map((line) => {
        if (!line.trim()) return line;
        if (removing) return line.replace(targetPrefix, "$1");

        const indent = line.match(/^(\s*)/)?.[1] ?? "";
        const content = line.replace(BULLET_PREFIX, "$1").replace(ORDERED_PREFIX, "$1").slice(indent.length);
        if (kind === "bullet") return `${indent}- ${content}`;
        orderedIndex += 1;
        return `${indent}${orderedIndex}. ${content}`;
    });

    const replacement = nextLines.join("\n");
    return {
        text: `${text.slice(0, lineStart)}${replacement}${text.slice(lineEnd)}`,
        selection: { start: lineStart, end: lineStart + replacement.length },
    };
}
