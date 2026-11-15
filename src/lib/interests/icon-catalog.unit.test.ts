import { describe, expect, it } from "vitest";
import { INTEREST_ICONS, getInterestIcon, searchInterestIcons } from "./icon-catalog";

describe("interest icon catalog", () => {
    it("has no duplicate names and every entry is searchable", () => {
        const names = INTEREST_ICONS.map((entry) => entry.name);
        expect(new Set(names).size).toBe(names.length);
        for (const entry of INTEREST_ICONS) {
            expect(entry.name, "stable kebab-case id").toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
            expect(entry.label.length, entry.name).toBeGreaterThan(0);
            expect(entry.keywords.length, entry.name).toBeGreaterThan(0);
            expect(entry.icon, entry.name).toBeTruthy();
        }
    });

    it("is a focused set, not the whole Lucide library", () => {
        expect(INTEREST_ICONS.length).toBeGreaterThanOrEqual(100);
        expect(INTEREST_ICONS.length).toBeLessThanOrEqual(250);
    });

    it("looks an icon up by stable name", () => {
        expect(getInterestIcon("guitar")?.label).toBe("Guitar");
        expect(getInterestIcon("nope")).toBeUndefined();
    });

    it("returns the whole catalog for an empty query", () => {
        expect(searchInterestIcons("")).toBe(INTEREST_ICONS);
        expect(searchInterestIcons("   ")).toBe(INTEREST_ICONS);
    });

    it("matches by name and by keyword, case-insensitively", () => {
        expect(searchInterestIcons("GUITAR").map((entry) => entry.name)).toContain("guitar");
        // "football" is only a keyword of the goal icon.
        expect(searchInterestIcons("football").map((entry) => entry.name)).toContain("goal");
        expect(searchInterestIcons("chess").map((entry) => entry.name)).toEqual(expect.arrayContaining(["crown", "castle"]));
        expect(searchInterestIcons("photography").map((entry) => entry.name)).toEqual(expect.arrayContaining(["camera", "aperture"]));
    });

    it("ranks exact and prefix matches before loose matches", () => {
        const results = searchInterestIcons("music").map((entry) => entry.name);
        expect(results.slice(0, 2)).toEqual(expect.arrayContaining(["music"]));
        expect(results.indexOf("music")).toBeLessThan(results.indexOf("headphones"));
    });

    it("returns nothing for a query that matches no icon", () => {
        expect(searchInterestIcons("zzzzzz")).toEqual([]);
    });
});
