import { describe, expect, it } from "vitest";
import { QA_RESUME_FIXTURES } from "@/lib/qa/sample-resumes";
import { sortKeys } from "./sort";

describe("sortKeys", () => {
    for (const fixture of QA_RESUME_FIXTURES) it(`sorts ${fixture.id} without changing values or array order`, () => {
        const resume = fixture.create();
        const result = sortKeys(JSON.stringify(resume));
        expect(JSON.parse(result)).toEqual(JSON.parse(JSON.stringify(resume)));
        expect(JSON.parse(result).experience.map((entry: { id: string }) => entry.id)).toEqual(resume.experience.map(entry => entry.id));
        expect(result.indexOf('"createdAt"')).toBeLessThan(result.indexOf('"experience"'));
    });
    it("sorts numeric-looking record keys lexically and rejects invalid JSON", () => {
        expect(sortKeys('{"2":false,"10":true}').indexOf('"10"')).toBeLessThan(sortKeys('{"2":false,"10":true}').indexOf('"2"'));
        expect(() => sortKeys("{ broken")).toThrow();
    });
});
