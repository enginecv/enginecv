import { describe, expect, it } from "vitest";
import { createQaFullResume } from "@/lib/qa/sample-resumes";
import { checkShrink, removedEntryTitles } from "./shrink-guard";

describe("shrink guard", () => {
    it("triggers when fewer than half are kept and at least three are removed", () => {
        expect(checkShrink(10, 4)).toMatchObject({ triggered: true, removedCount: 6 });
        expect(checkShrink(5, 2)).toMatchObject({ triggered: true, removedCount: 3 });
        expect(checkShrink(4, 1)).toMatchObject({ triggered: true, removedCount: 3 });
        expect(checkShrink(60, 0)).toMatchObject({ triggered: true, removedCount: 60 });
    });

    it("lets smaller removals through, and exactly half", () => {
        expect(checkShrink(10, 5).triggered).toBe(false); // exactly half is not fewer than half
        expect(checkShrink(10, 6).triggered).toBe(false);
        expect(checkShrink(3, 1).triggered).toBe(false); // only two removed
        expect(checkShrink(2, 0).triggered).toBe(false);
        expect(checkShrink(10, 12)).toMatchObject({ triggered: false, removedCount: 0 });
        expect(checkShrink(0, 0).triggered).toBe(false);
    });

    it("names the entries that would be removed, capped for the dialog", () => {
        const before = createQaFullResume();
        const after = { ...before, experience: [], education: [], projects: [] };
        const { titles, total } = removedEntryTitles(before, after, 10);
        expect(total).toBe(before.experience.length + before.education.length + before.projects.length);
        expect(titles.length).toBeLessThanOrEqual(10);
        expect(titles.every((title) => title.length > 0)).toBe(true);
        expect(removedEntryTitles(before, before).total).toBe(0);
    });
});
