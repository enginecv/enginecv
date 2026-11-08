/**
 * Converts Europass rich-text descriptions into the editor's Markdown subset
 * (paragraphs, flat bullet/ordered lists, bold, italic, code, links).
 *
 * The current Europass editor is Quill, which writes bullet lists as
 * `<ol><li data-list="bullet">` and marks nesting with `ql-indent-N` classes;
 * the editor has no nested lists, so indented items are flattened.
 */

const BLOCK_TAGS = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "section", "article"]);

function collapse(text: string): string {
    return text.replace(/\s+/g, " ");
}

function safeHref(href: string | null): string | null {
    if (!href) return null;
    const trimmed = href.trim();
    return /^(https?:|mailto:)/i.test(trimmed) ? trimmed : null;
}

function wrap(marker: string, inner: string): string {
    const trimmed = inner.trim();
    if (!trimmed) return inner;
    // Keep surrounding spaces outside the markers so `** bold**` never appears.
    const leading = inner.startsWith(" ") ? " " : "";
    const trailing = inner.endsWith(" ") ? " " : "";
    return `${leading}${marker}${trimmed}${marker}${trailing}`;
}

function renderInline(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return collapse(node.textContent ?? "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const element = node as Element;
    const tag = element.localName;
    if (element.classList.contains("ql-ui")) return "";

    const children = () => Array.from(element.childNodes).map(renderInline).join("");

    switch (tag) {
        case "br":
            return " ";
        case "strong":
        case "b":
            return wrap("**", children());
        case "em":
        case "i":
            return wrap("*", children());
        case "code":
            return wrap("`", children());
        case "a": {
            const text = children().trim();
            const href = safeHref(element.getAttribute("href"));
            if (!href) return text;
            return `[${text || href}](${href})`;
        }
        case "ul":
        case "ol":
            // A list inside inline content (e.g. inside <li>) is handled by the
            // block walker; render nothing here so text is not duplicated.
            return "";
        default:
            return BLOCK_TAGS.has(tag) ? ` ${children()} ` : children();
    }
}

function cleanLine(text: string): string {
    return collapse(text).trim();
}

function isOrderedItem(list: Element, item: Element): boolean {
    const dataList = item.getAttribute("data-list");
    if (dataList === "bullet") return false;
    if (dataList === "ordered") return true;
    return list.localName === "ol";
}

function renderList(list: Element, lines: string[]): void {
    // Quill mixes bullet and ordered items in one <ol>; numbering restarts
    // whenever the run of ordered items is broken.
    let index = 0;
    for (const child of Array.from(list.children)) {
        if (child.localName !== "li") {
            if (child.localName === "ul" || child.localName === "ol") renderList(child, lines);
            continue;
        }
        const ordered = isOrderedItem(list, child);
        index = ordered ? index + 1 : 0;
        const text = cleanLine(Array.from(child.childNodes).map(renderInline).join(""));
        if (text) lines.push(`${ordered ? `${index}.` : "-"} ${text}`);
        for (const nested of Array.from(child.children)) {
            if (nested.localName === "ul" || nested.localName === "ol") renderList(nested, lines);
        }
    }
}

export function europassHtmlToMarkdown(html: string): string {
    const source = html.trim();
    if (!source) return "";

    // Legacy files often hold plain text; keep its line structure.
    if (!/<[a-z][\s\S]*>/i.test(source)) {
        return source
            .split(/\r?\n/)
            .map((line) => line.trim())
            .join("\n")
            .replace(/\n{3,}/g, "\n\n");
    }

    const document = new DOMParser().parseFromString(`<body>${source}</body>`, "text/html");
    const blocks: string[] = [];
    let inline = "";

    const flushInline = () => {
        const text = cleanLine(inline);
        if (text) blocks.push(text);
        inline = "";
    };

    const walk = (parent: Node) => {
        for (const node of Array.from(parent.childNodes)) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as Element;
                const tag = element.localName;

                if (tag === "ul" || tag === "ol") {
                    flushInline();
                    const lines: string[] = [];
                    renderList(element, lines);
                    if (lines.length > 0) blocks.push(lines.join("\n"));
                    continue;
                }

                if (BLOCK_TAGS.has(tag)) {
                    flushInline();
                    const hasNestedBlocks = Array.from(element.children).some(
                        (child) => BLOCK_TAGS.has(child.localName) || child.localName === "ul" || child.localName === "ol",
                    );
                    if (hasNestedBlocks) {
                        walk(element);
                        flushInline();
                    } else {
                        const text = cleanLine(renderInline(element));
                        if (text) blocks.push(text);
                    }
                    continue;
                }
            }
            inline += renderInline(node);
        }
    };

    walk(document.body);
    flushInline();
    return blocks.join("\n\n");
}
