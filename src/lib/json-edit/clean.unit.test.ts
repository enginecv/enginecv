import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createQaFullResume } from "@/lib/qa/sample-resumes";
import { cleanBuffer } from "./clean";
import { serializeForEditing } from "./serialize";
import { validateBuffer } from "./validate";

describe("reviewed stored-format cleanup", () => {
    const resume = createQaFullResume();
    const context = { snapshot: resume, photo: resume.basics.photo, resumeId: resume.id! };
    it("keeps clean input byte-for-byte, with no notices", () => {
        const text = serializeForEditing(resume).text;
        expect(cleanBuffer(text)).toEqual({ status: "ok", text, notices: [] });
    });
    it("normalises only known stored paths, preserving prose", () => {
        const value = JSON.parse(serializeForEditing(resume).text);
        value.experience[0].start = "March 2021";
        value.experience[0].description = "March 2021";
        value.basics.website = "example.com";
        value.languages[0].fluency = "b2";
        value.skillGroups[0].skills[0].level = "advanced";
        value.experience[0].skills = "TypeScript, Go";
        value.experience[0].unknown = "removed";
        const result = cleanBuffer(JSON.stringify(value));
        expect(result.status).toBe("ok");
        const cleaned = JSON.parse(result.text!);
        expect(cleaned.experience[0]).toMatchObject({ start: "2021-03", description: "March 2021", skills: ["TypeScript", "Go"] });
        expect(cleaned.experience[0]).not.toHaveProperty("unknown");
        expect(cleaned.basics.website).toBe("https://example.com");
        expect(cleaned.languages[0].fluency).toBe("B2");
        expect(cleaned.skillGroups[0].skills[0].level).toBe("proficient");
        for (const code of ["date-normalised", "link-normalised", "language-normalised", "skill-normalised", "list-split", "unknown-field-skipped"]) expect(result.notices.some(notice => notice.code === code)).toBe(true);
        expect(validateBuffer(result.text!, context).status).toBe("valid");
    });
    it("reports uncertain values for review and unrepaired syntax without replacing text", () => {
        const value = JSON.parse(serializeForEditing(resume).text);
        value.languages[0].fluency = "almost fluent";
        const result = cleanBuffer(JSON.stringify(value));
        expect(result.notices).toContainEqual(expect.objectContaining({ kind: "review", code: "language-level-unrecognised", path: "languages[0].fluency" }));
        expect(cleanBuffer('{\n"meta": { "title": "x" "bad" }\n}')).toMatchObject({ status: "blocked", error: { code: "invalid-json", line: 2 } });
        expect(cleanBuffer('```json\n{"format":"enginecv.authoring/v1","basics":{}}\n```')).toMatchObject({ status: "blocked", authoring: true });
    });
    it("repairs at least 9 of 10 QA-derived messy documents in one pass, with every repair named", () => {
        const dir = join(__dirname, "__fixtures__", "messy");
        const files = readdirSync(dir).filter(file => file.endsWith(".json"));
        expect(files.length).toBeGreaterThanOrEqual(10);
        let valid = 0;
        for (const file of files) {
            const sample = JSON.parse(readFileSync(join(dir, file), "utf8")) as { text: string; codes: string[] };
            const result = cleanBuffer(sample.text);
            expect(result.status, file).toBe("ok");
            for (const code of sample.codes) expect(result.notices.some(notice => notice.code === code), `${file}: ${code}`).toBe(true);
            expect(result.notices.every(notice => notice.path)).toBe(true);
            if (validateBuffer(result.text!, context).status === "valid") valid++;
        }
        expect(valid / files.length).toBeGreaterThanOrEqual(0.9);
    });
});
