import type { ReactNode } from "react";
import { parseMarkdownBlocks, type InlineToken } from "@/lib/markdown-inline";
import { CHIP_END, CHIP_START, CHIP_UNRESOLVED_START } from "@/lib/letters/tokens";

/** Text that may hold chip markers becomes plain text and token chips. */
function renderText(value: string, keyBase: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    let index = 0;
    let key = 0;
    while (index < value.length) {
        const start = Math.min(
            ...[CHIP_START, CHIP_UNRESOLVED_START].map((marker) => {
                const at = value.indexOf(marker, index);
                return at === -1 ? Number.POSITIVE_INFINITY : at;
            }),
        );
        if (!Number.isFinite(start)) {
            nodes.push(value.slice(index));
            break;
        }
        if (start > index) nodes.push(value.slice(index, start));
        const end = value.indexOf(CHIP_END, start + 1);
        const stop = end === -1 ? value.length : end;
        const content = value.slice(start + 1, stop);
        nodes.push(
            value[start] === CHIP_UNRESOLVED_START
                ? <span key={`${keyBase}-${key++}`} data-letter-chip="unresolved" className="letter-chip-unresolved">{content}</span>
                : <span key={`${keyBase}-${key++}`} data-letter-chip="resolved" className="letter-chip">{content}</span>,
        );
        index = end === -1 ? value.length : end + 1;
    }
    return nodes;
}

function renderInline(tokens: InlineToken[], keyBase: string): ReactNode[] {
    return tokens.map((token, position) => {
        const key = `${keyBase}-${position}`;
        switch (token.type) {
            case "text":
                return <span key={key}>{renderText(token.value, key)}</span>;
            case "strong":
                return <strong key={key}>{renderInline(token.children, key)}</strong>;
            case "em":
                return <em key={key}>{renderInline(token.children, key)}</em>;
            case "code":
                return <span key={key}>{token.value}</span>;
            case "link":
                return <a key={key} href={token.url} style={{ color: "inherit", textDecoration: "underline" }}>{renderInline(token.children, key)}</a>;
        }
    });
}

/**
 * A letter paragraph's markdown (bold, italic, links, bullet and numbered lists)
 * as React nodes. Token values arrive wrapped in chip markers and are drawn as chips.
 */
export function LetterMarkdown({ markdown }: { markdown: string }) {
    const blocks = parseMarkdownBlocks(markdown);
    return (
        <>
            {blocks.map((block, index) =>
                block.type === "paragraph" ? (
                    <p key={index} style={{ margin: index === 0 ? 0 : "0.6em 0 0" }}>{renderInline(block.content, `p${index}`)}</p>
                ) : block.ordered ? (
                    <ol key={index} style={{ margin: "0.4em 0 0", paddingLeft: "1.4em" }}>
                        {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `o${index}-${itemIndex}`)}</li>)}
                    </ol>
                ) : (
                    <ul key={index} style={{ margin: "0.4em 0 0", paddingLeft: "1.4em", listStyleType: "disc" }}>
                        {block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item, `u${index}-${itemIndex}`)}</li>)}
                    </ul>
                ),
            )}
        </>
    );
}
