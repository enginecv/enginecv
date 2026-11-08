import { describe, expect, it } from "vitest";
import { inlineToPlainText, parseMarkdownBlocks, tokenizeInline, type MarkdownBlock } from "./markdown-inline";

describe("tokenizeInline", () => {
    it("keeps plain text as a single token", () => {
        expect(tokenizeInline("just words")).toEqual([{ type: "text", value: "just words" }]);
    });

    it("reads bold, italic and code", () => {
        expect(tokenizeInline("**b** *i* `c`")).toEqual([
            { type: "strong", children: [{ type: "text", value: "b" }] },
            { type: "text", value: " " },
            { type: "em", children: [{ type: "text", value: "i" }] },
            { type: "text", value: " " },
            { type: "code", value: "c" },
        ]);
    });

    it("prefers the two-character markers over the one-character ones", () => {
        expect(tokenizeInline("__bold__")).toEqual([
            { type: "strong", children: [{ type: "text", value: "bold" }] },
        ]);
    });

    it("reads links and keeps formatting inside the label", () => {
        expect(tokenizeInline("[**docs**](https://x.dev)")).toEqual([
            {
                type: "link",
                url: "https://x.dev",
                children: [{ type: "strong", children: [{ type: "text", value: "docs" }] }],
            },
        ]);
    });

    it("leaves an unmatched marker as literal text instead of swallowing the line", () => {
        expect(inlineToPlainText(tokenizeInline("2 * 3 = 6 and [broken"))).toBe("2 * 3 = 6 and [broken");
    });

    it("does not treat a bare URL as a link", () => {
        expect(tokenizeInline("see https://x.dev")).toEqual([{ type: "text", value: "see https://x.dev" }]);
    });
});

describe("parseMarkdownBlocks", () => {
    it("splits paragraphs on blank lines and joins wrapped lines", () => {
        const blocks = parseMarkdownBlocks("one\nstill one\n\ntwo");
        expect(blocks).toHaveLength(2);
        expect(inlineToPlainText((blocks[0] as Extract<MarkdownBlock, { type: "paragraph" }>).content)).toBe("one still one");
    });

    it("groups consecutive bullets into one list", () => {
        const blocks = parseMarkdownBlocks("- a\n- b");
        expect(blocks).toEqual([
            {
                type: "list",
                ordered: false,
                items: [[{ type: "text", value: "a" }], [{ type: "text", value: "b" }]],
            },
        ]);
    });

    it("starts a new list when the marker kind changes", () => {
        const blocks = parseMarkdownBlocks("- a\n1. b");
        expect(blocks.map((block) => (block as { ordered: boolean }).ordered)).toEqual([false, true]);
    });

    it("strips a leading heading marker rather than nesting a heading", () => {
        expect(parseMarkdownBlocks("## Title")).toEqual([
            { type: "paragraph", content: [{ type: "text", value: "Title" }] },
        ]);
    });

    it("returns nothing for empty input", () => {
        expect(parseMarkdownBlocks("   \n\n  ")).toEqual([]);
    });
});
