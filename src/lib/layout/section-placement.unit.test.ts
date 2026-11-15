import { describe, expect, it } from "vitest";
import {
    getDefaultPlacement,
    resolvePlacement,
    resolveSectionPlacements,
} from "./section-placement";

const baseOf = (key: string) => key.split(":")[0];

describe("getDefaultPlacement", () => {
    it("alternates left and right in two-column mode", () => {
        expect([0, 1, 2, 3].map((i) => getDefaultPlacement(i, "two"))).toEqual(["left", "right", "left", "right"]);
    });

    it("makes the first section full width in mixed mode, then alternates", () => {
        expect([0, 1, 2, 3].map((i) => getDefaultPlacement(i, "mix"))).toEqual(["full", "right", "left", "right"]);
    });
});

describe("resolvePlacement", () => {
    it("honours an explicit left and right in two-column mode at any position", () => {
        for (const index of [0, 1, 2, 3, 4, 5]) {
            expect(resolvePlacement("left", index, "two")).toBe("left");
            expect(resolvePlacement("right", index, "two")).toBe("right");
        }
    });

    it("falls back to the position default for an absent, full or invalid value in two-column mode", () => {
        expect(resolvePlacement(undefined, 1, "two")).toBe("right");
        expect(resolvePlacement("full", 1, "two")).toBe("right");
        expect(resolvePlacement("full", 2, "two")).toBe("left");
        expect(resolvePlacement("middle", 3, "two")).toBe("right");
    });

    it("honours left, right and full in mixed mode and defaults an absent value by position", () => {
        expect(resolvePlacement("left", 1, "mix")).toBe("left");
        expect(resolvePlacement("right", 2, "mix")).toBe("right");
        expect(resolvePlacement("full", 3, "mix")).toBe("full");
        expect(resolvePlacement(undefined, 0, "mix")).toBe("full");
        expect(resolvePlacement(undefined, 1, "mix")).toBe("right");
        expect(resolvePlacement("garbage", 2, "mix")).toBe("left");
    });
});

describe("resolveSectionPlacements", () => {
    it("counts positions only over the keys it is given", () => {
        const keys = ["skills", "projects", "education"];
        expect(resolveSectionPlacements(keys, {}, "two", baseOf)).toEqual({ skills: "left", projects: "right", education: "left" });
        // A hidden or empty section is simply not in `keys`, so it does not shift the others.
        expect(resolveSectionPlacements(["skills", "education"], {}, "two", baseOf)).toEqual({ skills: "left", education: "right" });
    });

    it("keeps a stored left on a position whose default is right (the reported case)", () => {
        const placements = resolveSectionPlacements(["a", "b", "c", "d"], { b: "left", d: "left" }, "two", baseOf);
        expect(placements).toEqual({ a: "left", b: "left", c: "left", d: "left" });
    });

    it("looks up the stored side by key first, then by base id", () => {
        const placements = resolveSectionPlacements(["custom:1", "custom:2", "skills"], { "custom:1": "right", custom: "left", skills: "right" }, "two", baseOf);
        expect(placements["custom:1"]).toBe("right");
        expect(placements["custom:2"]).toBe("left");
        expect(placements.skills).toBe("right");
    });

    it("handles an empty list and mixed mode", () => {
        expect(resolveSectionPlacements([], { a: "left" }, "two", baseOf)).toEqual({});
        expect(resolveSectionPlacements(["a", "b", "c"], { b: "full" }, "mix", baseOf)).toEqual({ a: "full", b: "full", c: "left" });
    });

    it("tolerates a missing stored record", () => {
        expect(resolveSectionPlacements(["a"], undefined, "two", baseOf)).toEqual({ a: "left" });
    });
});
