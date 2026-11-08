import { describe, expect, it } from "vitest";
import { toggleMarkdownList } from "./markdown-lists";

describe("toggleMarkdownList", () => {
    it("toggles a bullet marker instead of stacking it", () => {
        const added = toggleMarkdownList("one", { start: 3, end: 3 }, "bullet");
        expect(added.text).toBe("- one");

        const removed = toggleMarkdownList(added.text, { start: 5, end: 5 }, "bullet");
        expect(removed.text).toBe("one");
    });

    it("converts bullet lines to sequential numbering", () => {
        const result = toggleMarkdownList("- one\n- two", { start: 0, end: 11 }, "ordered");
        expect(result.text).toBe("1. one\n2. two");
    });

    it("removes numbering from selected lines on second activation", () => {
        const result = toggleMarkdownList("1. one\n2. two", { start: 0, end: 13 }, "ordered");
        expect(result.text).toBe("one\ntwo");
    });
});
