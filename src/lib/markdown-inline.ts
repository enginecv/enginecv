/**
 * A small Markdown reader for the subset the editor's rich text can produce:
 * paragraphs, bullet and ordered lists, and inline bold / italic / code / links.
 *
 * Exporters need the *structure*, not HTML — Markdown wants `**...**`, DOCX
 * wants a bold `TextRun` — so this yields neutral tokens both can walk. It is
 * deliberately not a full CommonMark parser: anything it does not recognise
 * stays literal text, which is the safe outcome for a resume.
 */

export type InlineToken =
    | { type: "text"; value: string }
    | { type: "strong"; children: InlineToken[] }
    | { type: "em"; children: InlineToken[] }
    | { type: "code"; value: string }
    | { type: "link"; url: string; children: InlineToken[] };

export type MarkdownBlock =
    | { type: "paragraph"; content: InlineToken[] }
    | { type: "list"; ordered: boolean; items: InlineToken[][] };

interface InlineRule {
    pattern: RegExp;
    build: (match: RegExpMatchArray) => InlineToken;
}

// Order matters: `**` has to be tried before `*`, `__` before `_`.
const INLINE_RULES: InlineRule[] = [
    { pattern: /^\[([^\]]*)\]\(([^)\s]+)\)/, build: (m) => ({ type: "link", url: m[2], children: tokenizeInline(m[1]) }) },
    { pattern: /^`([^`]+)`/, build: (m) => ({ type: "code", value: m[1] }) },
    { pattern: /^\*\*([^*]+)\*\*/, build: (m) => ({ type: "strong", children: tokenizeInline(m[1]) }) },
    { pattern: /^__([^_]+)__/, build: (m) => ({ type: "strong", children: tokenizeInline(m[1]) }) },
    { pattern: /^\*([^*]+)\*/, build: (m) => ({ type: "em", children: tokenizeInline(m[1]) }) },
    { pattern: /^_([^_]+)_/, build: (m) => ({ type: "em", children: tokenizeInline(m[1]) }) },
];

export function tokenizeInline(markdown: string): InlineToken[] {
    const tokens: InlineToken[] = [];
    let rest = markdown;
    let literal = "";

    const flush = () => {
        if (!literal) return;
        tokens.push({ type: "text", value: literal });
        literal = "";
    };

    while (rest.length > 0) {
        const rule = INLINE_RULES.find((candidate) => candidate.pattern.test(rest));

        if (rule) {
            const match = rest.match(rule.pattern)!;
            flush();
            tokens.push(rule.build(match));
            rest = rest.slice(match[0].length);
            continue;
        }

        // No rule matched at this position: take one character literally and
        // retry, so a stray `*` or `[` cannot swallow the rest of the line.
        literal += rest[0];
        rest = rest.slice(1);
    }

    flush();
    return tokens;
}

/**
 * Splits a body into blocks. Blank lines end a paragraph or list; a run of
 * `-`/`*`/`+` lines is a bullet list and `1.`/`1)` an ordered one. Leading `#`
 * is stripped rather than turned into a heading: entry bodies sit under the
 * entry's own title, so a nested heading level would fight the document's.
 */
export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
    const blocks: MarkdownBlock[] = [];
    let paragraph: string[] = [];
    let items: string[] | null = null;
    let ordered = false;

    const flushParagraph = () => {
        if (paragraph.length === 0) return;
        blocks.push({ type: "paragraph", content: tokenizeInline(paragraph.join(" ")) });
        paragraph = [];
    };

    const flushList = () => {
        if (!items) return;
        blocks.push({ type: "list", ordered, items: items.map(tokenizeInline) });
        items = null;
    };

    for (const rawLine of markdown.split(/\r?\n/)) {
        const line = rawLine.trim();

        if (!line) {
            flushParagraph();
            flushList();
            continue;
        }

        const bullet = /^[-*+]\s+(.*)$/.exec(line);
        const numbered = /^\d+[.)]\s+(.*)$/.exec(line);

        if (bullet || numbered) {
            flushParagraph();
            const isOrdered = Boolean(numbered);
            if (items && ordered !== isOrdered) flushList();
            ordered = isOrdered;
            items = items ?? [];
            items.push((bullet ?? numbered)![1]);
            continue;
        }

        flushList();
        paragraph.push(line.replace(/^#+\s*/, ""));
    }

    flushParagraph();
    flushList();
    return blocks;
}

/** Everything a token tree says, with the formatting dropped. */
export function inlineToPlainText(tokens: InlineToken[]): string {
    return tokens
        .map((token) => {
            if (token.type === "text") return token.value;
            if (token.type === "code") return token.value;
            return inlineToPlainText(token.children);
        })
        .join("");
}
