import { describe, expect, it } from "vitest";
import { paginate, sortDashboardItems } from "./dashboard-list";

const items = [
    { name: "beta", createdAt: 3, updatedAt: 10 },
    { name: "", createdAt: 1, updatedAt: 30 },
    { name: "Alpha", createdAt: 2, updatedAt: 20 },
    { name: "item 10", createdAt: 4, updatedAt: 5 },
    { name: "item 9", createdAt: 5, updatedAt: 5 },
];
const describeItem = (item: (typeof items)[number]) => item;
const names = (list: typeof items) => list.map((item) => item.name);

describe("sortDashboardItems", () => {
    it("orders by last edited, newest first, keeping ties in input order", () => {
        expect(names(sortDashboardItems(items, "updated", describeItem))).toEqual(["", "Alpha", "beta", "item 10", "item 9"]);
    });

    it("orders by creation date, newest first", () => {
        expect(names(sortDashboardItems(items, "created", describeItem))).toEqual(["item 9", "item 10", "beta", "Alpha", ""]);
    });

    it("orders names case-insensitively and numerically, untitled last", () => {
        expect(names(sortDashboardItems(items, "name-asc", describeItem))).toEqual(["Alpha", "beta", "item 9", "item 10", ""]);
        expect(names(sortDashboardItems(items, "name-desc", describeItem))).toEqual(["item 10", "item 9", "beta", "Alpha", ""]);
    });

    it("does not mutate the input", () => {
        const copy = [...items];
        sortDashboardItems(items, "name-asc", describeItem);
        expect(items).toEqual(copy);
    });
});

describe("paginate", () => {
    const list = Array.from({ length: 30 }, (_, index) => index);

    it("slices one page and counts pages", () => {
        expect(paginate(list, 2, "12")).toEqual({ items: list.slice(12, 24), page: 2, pageCount: 3, total: 30 });
    });

    it("clamps out-of-range pages", () => {
        expect(paginate(list, 9, "12").page).toBe(3);
        expect(paginate(list, 0, "12").page).toBe(1);
        expect(paginate([], 4, "24")).toEqual({ items: [], page: 1, pageCount: 1, total: 0 });
    });

    it("returns everything for all", () => {
        expect(paginate(list, 3, "all")).toEqual({ items: list, page: 1, pageCount: 1, total: 30 });
    });
});
