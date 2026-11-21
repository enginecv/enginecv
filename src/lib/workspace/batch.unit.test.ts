import { describe, expect, it } from "vitest";
import { forEachInSlices, mapInSlices } from "./batch";

describe("batching", () => {
    it("yields between slices so no synchronous run exceeds the budget by more than one item", async () => {
        let clock = 0;
        const slices: number[] = [];
        let current = 0;
        const items = Array.from({ length: 100 }, (_, i) => i);
        const out = await mapInSlices(
            items,
            (item) => {
                clock += 5; // each item "costs" 5 ms
                current += 5;
                return item * 2;
            },
            {
                budgetMs: 12,
                now: () => clock,
                yieldToBrowser: async () => {
                    slices.push(current);
                    current = 0;
                },
            },
        );
        expect(out).toEqual(items.map((item) => item * 2));
        expect(slices.length).toBeGreaterThan(20);
        expect(Math.max(...slices)).toBeLessThanOrEqual(15); // 12 ms budget plus the item that crossed it
    });

    it("keeps order and runs async work in slices", async () => {
        let clock = 0;
        let yields = 0;
        const seen: number[] = [];
        await forEachInSlices([1, 2, 3, 4, 5, 6], async (item) => { clock += 10; seen.push(item); }, { budgetMs: 15, now: () => clock, yieldToBrowser: async () => { yields += 1; } });
        expect(seen).toEqual([1, 2, 3, 4, 5, 6]);
        expect(yields).toBe(2);
    });

    it("does not yield for work that fits in one slice", async () => {
        let yields = 0;
        await mapInSlices([1, 2, 3], (x) => x, { budgetMs: 1000, yieldToBrowser: async () => { yields += 1; } });
        expect(yields).toBe(0);
    });
});
