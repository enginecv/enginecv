import { describe, expect, it } from "vitest";
import { parseMarkdownBlocks } from "@/lib/markdown-inline";
import { europassHtmlToMarkdown } from "./html-to-markdown";

describe("europassHtmlToMarkdown", () => {
    it("turns Quill bullet lists into flat Markdown bullets", () => {
        const html =
            '<p>Worked on:</p><ol><li data-list="bullet"><span class="ql-ui"></span>Project one</li>' +
            '<li data-list="bullet" class="ql-indent-1"><span class="ql-ui"></span>Role: backend</li>' +
            '<li data-list="ordered"><span class="ql-ui"></span>Numbered</li></ol>';
        expect(europassHtmlToMarkdown(html)).toBe("Worked on:\n\n- Project one\n- Role: backend\n1. Numbered");
    });

    it("keeps inline formatting and safe links only", () => {
        const html = '<p>Built <strong>fast</strong> <em>APIs</em> for <a href="https://example.com">Acme</a> ' +
            'and <a href="javascript:alert(1)">evil</a><u> underlined</u>.</p>';
        expect(europassHtmlToMarkdown(html)).toBe("Built **fast** *APIs* for [Acme](https://example.com) and evil underlined.");
    });

    it("handles paragraphs nested in list items and styled spans", () => {
        const html = '<ul><li><p><strong>BE Languages</strong>: C#, Go</p></li><li><p>Cloud</p></li></ul>' +
            '<p class="ql-align-justify"><span style="color: rgb(51, 51, 51);">Styled text</span></p>';
        expect(europassHtmlToMarkdown(html)).toBe("- **BE Languages**: C#, Go\n- Cloud\n\nStyled text");
    });

    it("decodes entities and drops empty blocks", () => {
        expect(europassHtmlToMarkdown("<p>R&amp;D&nbsp;team</p><p><br></p><p></p>")).toBe("R&D team");
    });

    it("keeps legacy plain text line structure", () => {
        expect(europassHtmlToMarkdown("  First line\n  Second line  ")).toBe("First line\nSecond line");
        expect(europassHtmlToMarkdown("")).toBe("");
    });

    it("produces Markdown the editor's reader understands", () => {
        const markdown = europassHtmlToMarkdown('<p>Intro</p><ol><li data-list="bullet">One</li><li data-list="bullet">Two</li></ol>');
        expect(parseMarkdownBlocks(markdown).map((block) => block.type)).toEqual(["paragraph", "list"]);
    });
});
