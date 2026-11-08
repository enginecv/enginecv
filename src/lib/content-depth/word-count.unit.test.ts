import { describe, expect, it } from "vitest";
import { countWords, findDuplicates, MIN_COMPARABLE_WORDS, paragraphs, similarity, stripMarkdown } from "./word-count";

describe("countWords", () => {
    it("counts whitespace-separated words", () => {
        expect(countWords("one two  three\nfour")).toBe(4);
    });

    it("counts hyphenated terms and numbers as one word each", () => {
        expect(countWords("cut load time from 4.1 s to 1.3 s in a full-stack app")).toBe(13);
    });

    it("returns 0 for empty or whitespace input", () => {
        expect(countWords("")).toBe(0);
        expect(countWords("  \n\t ")).toBe(0);
    });
});

describe("stripMarkdown", () => {
    it("drops front matter", () => {
        expect(countWords(stripMarkdown("---\ntitle: \"A\"\ntags: [x, y]\n---\nBody words here."))).toBe(3);
    });

    it("drops fenced and inline code", () => {
        const text = stripMarkdown("Before `inline code` after.\n\n```ts\nconst a = 1;\nconst b = 2;\n```\n\nEnd.");
        expect(text).not.toContain("const");
        expect(text).not.toContain("inline");
        expect(countWords(text)).toBe(3);
    });

    it("keeps link text and drops the target", () => {
        const text = stripMarkdown("Read [the full guide](https://example.com/very/long/path) now.");
        expect(text).toContain("the full guide");
        expect(text).not.toContain("example.com");
    });

    it("drops HTML tags and heading, list and quote markers", () => {
        const text = stripMarkdown("## Heading\n\n- first item\n1. second item\n> quoted line\n\n<Callout>boxed</Callout>");
        expect(text).not.toMatch(/#|<|>|^\s*-/m);
        expect(countWords(text)).toBe(8);
    });

    it("returns an empty string for front matter only", () => {
        expect(countWords(stripMarkdown("---\ntitle: x\n---\n"))).toBe(0);
    });
});

describe("paragraphs", () => {
    it("splits on blank lines and trims", () => {
        expect(paragraphs("first line\nstill first\n\n\n  second  \n\nthird")).toEqual(["first line still first", "second", "third"]);
    });

    it("returns an empty list for empty input", () => {
        expect(paragraphs("  \n\n ")).toEqual([]);
    });
});

describe("similarity", () => {
    const text = "Lead each job with a result, not a duty, because a number is easy to check in an interview.";

    it("scores identical text as 1", () => {
        expect(similarity(text, text)).toBe(1);
    });

    it("ignores case and punctuation", () => {
        expect(similarity(text, text.toUpperCase().replace(/,/g, ""))).toBe(1);
    });

    it("scores unrelated text as 0", () => {
        expect(similarity(text, "Nurses document medication rounds, escalate changes in patient condition and hand over shifts clearly.")).toBe(0);
    });

    it("scores a pasted sentence inside a longer paragraph high", () => {
        const longer = `Opening remark about something else entirely. ${text} Closing remark about another thing again.`;
        expect(similarity(text, longer)).toBe(1);
    });

    it("scores texts shorter than one shingle as 0", () => {
        expect(similarity("two words", "two words")).toBe(0);
    });
});

describe("findDuplicates", () => {
    const shared = "Lead each job with a result rather than a duty because a number is easy to verify in an interview setting.";
    const unrelated = "Document medication rounds carefully, escalate changes in patient condition quickly and hand over every shift in writing.";

    it("flags a near-copy across two documents", () => {
        const pairs = findDuplicates([{ docId: "a", text: shared }, { docId: "b", text: `${shared} Extra closing words.` }], 0.6);
        expect(pairs).toHaveLength(1);
        expect(pairs[0].score).toBeGreaterThan(0.6);
    });

    it("ignores repeats inside the same document", () => {
        expect(findDuplicates([{ docId: "a", text: shared }, { docId: "a", text: shared }], 0.6)).toEqual([]);
    });

    it("ignores paragraphs under the comparable length", () => {
        const short = "Short shared label for a section heading";
        expect(countWords(short)).toBeLessThan(MIN_COMPARABLE_WORDS);
        expect(findDuplicates([{ docId: "a", text: short }, { docId: "b", text: short }], 0.6)).toEqual([]);
    });

    it("does not flag different paragraphs", () => {
        expect(findDuplicates([{ docId: "a", text: shared }, { docId: "b", text: unrelated }], 0.6)).toEqual([]);
    });
});
