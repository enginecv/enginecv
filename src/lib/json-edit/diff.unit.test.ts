import { describe, expect, it } from "vitest";
import { QA_RESUME_FIXTURES, createQaFullResume } from "@/lib/qa/sample-resumes";
import { diffResume } from "./diff";

describe("diffResume", () => {
    for (const fixture of QA_RESUME_FIXTURES) it(`identity is empty: ${fixture.id}`, () => {
        const r = fixture.create();
        expect(Object.values(diffResume(r, r)).flat()).toEqual([]);
    });
    it("matches array entries by id, reporting moves without field changes", () => {
        const before = createQaFullResume();
        const after = structuredClone(before);
        [after.experience[0], after.experience[1]] = [after.experience[1], after.experience[0]];
        expect(diffResume(before, after)).toMatchObject({ moved: ["experience[0]", "experience[1]"], changed: [], added: [], removed: [] });
    });
    it("reports field changes, additions, removals and regenerated ids", () => {
        const before = createQaFullResume();
        const after = structuredClone(before);
        after.experience[0].position = "Changed";
        expect(diffResume(before, after).changed).toEqual(["experience[0].position"]);
        after.experience.pop();
        after.experience[1].id = "replacement";
        const result = diffResume(before, after);
        expect(result.added).toContain("experience[1]");
        expect(result.removed).toContain("experience[3]");
        // Regeneration metadata belongs to validation; diff cannot infer intent.
        expect(result.regeneratedIds).toEqual([]);
    });
    it("works on generic values; compares ordinary arrays by index; ignores root updatedAt", () => {
        expect(diffResume({ list: ["a"], updatedAt: 1 }, { list: ["b", "c"], updatedAt: 2 })).toMatchObject({ changed: ["list[0]"], added: ["list[1]"] });
        expect(diffResume({ child: { updatedAt: 1 } }, { child: { updatedAt: 2 } }).changed).toEqual(["child.updatedAt"]);
    });
});
