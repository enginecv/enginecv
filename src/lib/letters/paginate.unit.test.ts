import { describe, expect, it } from "vitest";
import { paginateBlocks, type PageBlock } from "./paginate";

const block = (id: string, height: number, keepWithNext = false): PageBlock => ({ id, height, keepWithNext });

describe("paginateBlocks", () => {
    it("gives an empty letter one empty page", () => {
        expect(paginateBlocks([], 100)).toEqual([[]]);
    });

    it("keeps everything on one page when it fits", () => {
        expect(paginateBlocks([block("a", 30), block("b", 30), block("c", 30)], 100)).toEqual([["a", "b", "c"]]);
    });

    it("moves a block to the next page instead of cutting it", () => {
        expect(paginateBlocks([block("a", 60), block("b", 60), block("c", 30)], 100)).toEqual([["a"], ["b", "c"]]);
    });

    it("keeps a block with the next one when asked, moving both together", () => {
        const pages = paginateBlocks([block("a", 50), block("para", 30, true), block("closing", 30, true), block("signature", 20)], 100);
        expect(pages).toEqual([["a"], ["para", "closing", "signature"]]);
    });

    it("keeps the closing and signature together even when the closing alone would fit", () => {
        const pages = paginateBlocks([block("a", 70), block("closing", 20, true), block("signature", 20)], 100);
        expect(pages[pages.length - 1]).toEqual(["closing", "signature"]);
    });

    it("gives a block taller than a page a page of its own instead of dropping it", () => {
        expect(paginateBlocks([block("a", 20), block("huge", 500), block("b", 20)], 100)).toEqual([["a"], ["huge"], ["b"]]);
    });

    it("treats zero-height blocks as free and never starts with an empty second page", () => {
        expect(paginateBlocks([block("a", 0), block("b", 0)], 100)).toEqual([["a", "b"]]);
    });

    it("handles a trailing keepWithNext with nothing after it", () => {
        expect(paginateBlocks([block("a", 10, true)], 100)).toEqual([["a"]]);
    });
});

describe("paginateBlocks with a different height per page", () => {
    it("gives the first page less room than the others", () => {
        const blocks = [block("a", 40), block("b", 40), block("c", 40), block("d", 40)];
        // Page 0 holds 60 (one block), later pages hold 100 (two blocks).
        expect(paginateBlocks(blocks, (pageIndex) => (pageIndex === 0 ? 60 : 100))).toEqual([["a"], ["b", "c"], ["d"]]);
    });

    it("still accepts a single number", () => {
        expect(paginateBlocks([block("a", 40), block("b", 40)], 100)).toEqual([["a", "b"]]);
    });
});
