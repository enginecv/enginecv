import { describe, expect, it } from "vitest";
import { QA_RESUME_FIXTURES, createQaFullResume } from "@/lib/qa/sample-resumes";
import { serializeForEditing, PHOTO_TOKEN } from "./serialize";
import { validateBuffer } from "./validate";

const snapshot = createQaFullResume();
const context = { snapshot, photo: snapshot.basics.photo, resumeId: snapshot.id! };
const edit = (change: (value: typeof snapshot) => void) => {
    const value = JSON.parse(serializeForEditing(snapshot).text);
    change(value);
    return validateBuffer(JSON.stringify(value, null, 2), context);
};

describe("stored resume JSON boundary", () => {
    for (const fixture of QA_RESUME_FIXTURES) {
        it(`round trips ${fixture.id} without changing stored data`, () => {
            const resume = fixture.create();
            const serialized = serializeForEditing(resume);
            const result = validateBuffer(serialized.text, { snapshot: resume, photo: serialized.photo, resumeId: resume.id! });
            expect(result.problems).toEqual([]);
            expect(result.candidate).toEqual(resume);
        });
    }
    it("keeps embedded photo behind a token; deleting token clears it", () => {
        expect(serializeForEditing(snapshot).text).toContain(PHOTO_TOKEN);
        expect(edit(v => { v.basics.photo = ""; }).candidate?.basics.photo).toBe("");
        expect(edit(v => { delete (v.basics as Partial<typeof v.basics>).photo; }).candidate?.basics.photo).toBe("");
    });
    it("keeps ordinary photo URLs readable", () => {
        const resume = structuredClone(snapshot);
        resume.basics.photo = "https://example.com/photo.png";
        expect(serializeForEditing(resume).text).toContain(resume.basics.photo);
    });
    it("restores protected fields even when their edited type is wrong", () => {
        const result = edit(v => Object.assign(v, { id: 22, version: "bad", createdAt: 0 }));
        expect(result.candidate).toMatchObject({ id: snapshot.id, version: snapshot.version, createdAt: snapshot.createdAt });
        expect(result.notices.filter(n => n.code === "protected-field")).toHaveLength(3);
    });
    it("rejects duplicate entry ids without producing a candidate", () => {
        const result = edit(v => { v.experience[1].id = v.experience[0].id; });
        expect(result.candidate).toBeUndefined();
        expect(result.problems[0]).toMatchObject({ code: "duplicate-id", path: "experience[1].id" });
    });
    it("generates missing ids and lists their paths", () => {
        const result = edit(v => { delete (v.experience[0] as Partial<typeof v.experience[0]>).id; });
        expect(result.status).toBe("valid");
        expect(result.candidate?.experience[0].id).toBeTruthy();
        expect(result.candidate?.experience[0].id).not.toBe(snapshot.experience[0].id);
        expect(result.notices).toContainEqual(expect.objectContaining({ code: "id-regenerated", path: "experience[0].id" }));
    });
    it("applies schema defaults and rejects unknown fields instead of stripping them", () => {
        expect(edit(v => { delete (v.meta as Partial<typeof v.meta>).title; }).candidate?.meta.title).toBe("");
        const result = edit(v => Object.assign(v.experience[0], { madeUp: true }));
        expect(result.candidate).toBeUndefined();
        expect(result.problems).toContainEqual(expect.objectContaining({ code: "unknown-key", path: "experience[0].madeUp" }));
    });
    it("maps wrong types to the offending path and exact range", () => {
        const result = edit(v => Object.assign(v.experience[0], { position: 17 }));
        expect(result.problems[0]).toMatchObject({ code: "invalid-type", path: "experience[0].position" });
        expect(result.problems[0].line).toBeGreaterThan(1);
        expect(result.problems[0].to - result.problems[0].from).toBe(2);
    });
    it.each([
        ["", "empty"], ["[]", "not-object"], ["null", "not-object"],
        ['{"format":"enginecv.authoring/v1","basics":{}}', "authoring-format"],
        ['{"a":"' + "x".repeat(2 * 1024 * 1024) + '"}', "too-large"],
    ])("blocks %s as %s", (text, code) => {
        const result = validateBuffer(text, context);
        expect(result.status).toBe("invalid");
        expect(result.candidate).toBeUndefined();
        expect(result.problems[0].code).toBe(code);
    });
    it("reports strict syntax errors with line and column", () => {
        const result = validateBuffer('{\n"meta": { "title": "x", }\n}', context);
        expect(result.problems[0]).toMatchObject({ code: "syntax", line: 2 });
        expect(result.problems[0].column).toBeGreaterThan(1);
    });
    it("validates the largest QA fixture within the 50 ms responsiveness budget", () => {
        const largest = QA_RESUME_FIXTURES.map(fixture => { const resume = fixture.create(); return { resume, ...serializeForEditing(resume) }; }).sort((a, b) => b.text.length - a.text.length)[0];
        const ctx = { snapshot: largest.resume, photo: largest.photo, resumeId: largest.resume.id! };
        validateBuffer(largest.text, ctx); // warm the memoised schema, as during typing
        const timings = Array.from({ length: 5 }, () => { const start = performance.now(); const result = validateBuffer(largest.text, ctx); const elapsed = performance.now() - start; expect(result.status).toBe("valid"); return elapsed; });
        console.info(`JSON validation ${largest.text.length} chars: median ${[...timings].sort((a, b) => a - b)[2].toFixed(2)} ms, max ${Math.max(...timings).toFixed(2)} ms`);
        expect(Math.max(...timings)).toBeLessThanOrEqual(50);
    });
});
