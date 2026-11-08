import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { describe, expect, it } from "vitest";
import { fromHardBreaks, preserveLineBreaks } from "./markdown-breaks";

/** What the preview's inline editor returns for an untouched value (same extensions). */
function inlineEditorRoundTrip(markdown: string): string {
    const editor = new Editor({ extensions: [StarterKit, Markdown.configure({ html: false })], content: markdown });
    const out = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown();
    editor.destroy();
    return out;
}

describe("summary line breaks through the inline editor", () => {
    it.each([
        "Builder of local-first tools.\nLoves privacy, performance and **boring** tech.",
        "One paragraph.\n\nAnother one.",
        "Single line with *emphasis*.",
    ])("an unedited round trip keeps %j", (summary) => {
        expect(fromHardBreaks(inlineEditorRoundTrip(preserveLineBreaks(summary)))).toBe(summary);
    });

    it("only normalises a list into its own block, which renders the same (as for descriptions)", () => {
        expect(fromHardBreaks(inlineEditorRoundTrip(preserveLineBreaks("Intro:\n- first\n- second"))))
            .toBe("Intro:\n\n- first\n- second");
    });

    it("without the conversion the editor would join the lines (why it exists)", () => {
        expect(inlineEditorRoundTrip("a\nb")).toBe("a b");
    });
});

describe("preserveLineBreaks", () => {
    it("turns single line breaks into hard breaks", () => {
        expect(preserveLineBreaks("Builder of local-first tools.\nLoves privacy.")).toBe("Builder of local-first tools.  \nLoves privacy.");
    });

    it("leaves paragraphs, lists, quotes and headings alone", () => {
        const text = "Intro.\n\n- one\n- two\n\n> quote\n## Heading\n1. first\n2. second";
        expect(preserveLineBreaks(text)).toBe(text);
    });

    it("does not double existing hard breaks", () => {
        expect(preserveLineBreaks("a  \nb")).toBe("a  \nb");
    });

    it("keeps single-line and empty text as is", () => {
        expect(preserveLineBreaks("Just **one** line.")).toBe("Just **one** line.");
        expect(preserveLineBreaks("")).toBe("");
    });
});
