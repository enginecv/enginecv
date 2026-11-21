import { describe, expect, it } from "vitest";
import { pageOf } from "./paging";

describe("pageOf", () => {
    const items = Array.from({ length: 11 }, (_, index) => index);

    it("slices a page and counts the pages", () => {
        expect(pageOf(items, 1, 5)).toEqual({ items: [0, 1, 2, 3, 4], page: 1, pageCount: 3, total: 11 });
        expect(pageOf(items, 3, 5).items).toEqual([10]);
    });

    it("clamps a page that no longer exists", () => {
        expect(pageOf(items, 9, 5).page).toBe(3);
        expect(pageOf(items, 0, 5).page).toBe(1);
        expect(pageOf(items, Number.NaN, 5).page).toBe(1);
    });

    it("always has one page, even when empty", () => {
        expect(pageOf([], 1, 5)).toEqual({ items: [], page: 1, pageCount: 1, total: 0 });
    });
});
