import { describe, expect, it } from "vitest";
import { createQaFullResume } from "@/lib/qa/sample-resumes";
import { rangeForPath, pathAtOffset, segmentsForPath } from "./locate";
import { formatPath } from "@/lib/agent/authoring/notices";

describe("JSON locations", () => {
    const text = JSON.stringify(createQaFullResume(), null, 2);
    it("locates nested array values and missing-key parent fallback", () => {
        const range = rangeForPath(text, ["experience", 1, "position"])!;
        expect(JSON.parse(text.slice(range.from, range.to))).toBe(createQaFullResume().experience[1].position);
        expect(rangeForPath(text, ["experience", 0, "missing"])).toEqual(rangeForPath(text, ["experience", 0]));
        expect(rangeForPath("", ["missing"])).toBeNull();
    });
    it("maps keys and values back to paths", () => {
        const range = rangeForPath(text, ["experience", 0, "company"])!;
        expect(pathAtOffset(text, range.from + 2)).toEqual({ path: ["experience", 0, "company"], isKey: false });
        const key = text.lastIndexOf('"company"', range.from);
        expect(pathAtOffset(text, key + 2)).toEqual({ path: ["experience", 0, "company"], isKey: true });
    });
    it("round trips formatted notice paths including escaped record keys", () => {
        const path = ["settings", "odd.key", 2, 'quote"key', "C++"];
        expect(segmentsForPath(formatPath(path))).toEqual(path);
        expect(segmentsForPath("(document)")).toEqual([]);
    });
});
