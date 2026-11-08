import { describe, expect, it } from "vitest";
import { getRelativeHistorySelection } from "./history";

describe("getRelativeHistorySelection", () => {
    const entryIds = [30, 20, 10];

    it("moves backward from the live draft to the latest history entry", () => {
        expect(getRelativeHistorySelection(entryIds, null, "back")).toBe(30);
    });

    it("moves backward toward older history entries", () => {
        expect(getRelativeHistorySelection(entryIds, 30, "back")).toBe(20);
        expect(getRelativeHistorySelection(entryIds, 20, "back")).toBe(10);
    });

    it("stops at the oldest history entry when moving backward", () => {
        expect(getRelativeHistorySelection(entryIds, 10, "back")).toBe(10);
    });

    it("moves forward toward newer history entries and back to the live draft", () => {
        expect(getRelativeHistorySelection(entryIds, 10, "forward")).toBe(20);
        expect(getRelativeHistorySelection(entryIds, 20, "forward")).toBe(30);
        expect(getRelativeHistorySelection(entryIds, 30, "forward")).toBeNull();
    });

    it("returns null when there is no history to traverse", () => {
        expect(getRelativeHistorySelection([], null, "back")).toBeNull();
        expect(getRelativeHistorySelection([], 42, "forward")).toBeNull();
    });
});
