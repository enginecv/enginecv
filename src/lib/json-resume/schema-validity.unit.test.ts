import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createQaFullResume, createQaMinimalResume } from "@/lib/qa/sample-resumes";
import full from "@/lib/__fixtures__/json-resume/full.json";
import minimal from "@/lib/__fixtures__/json-resume/minimal.json";
import publishedSchema from "@/lib/__fixtures__/json-resume/schema.json";
import { resumeToJsonResume } from "./from-resume";
import { jsonResumeToResume } from "./to-resume";

const validator = z.fromJSONSchema(publishedSchema as never);

describe("exports validate against the published JSON Resume schema", () => {
    it("accepts the fixtures themselves, so the validator is meaningful", () => {
        expect(validator.safeParse(full).success).toBe(true);
        expect(validator.safeParse(minimal).success).toBe(true);
        expect(validator.safeParse({ basics: { email: "not an email" } }).success).toBe(false);
        expect(validator.safeParse({ work: [{ startDate: "June 2019" }] }).success).toBe(false);
    });

    const cases = {
        "QA full CV": createQaFullResume(),
        "QA minimal CV": createQaMinimalResume(),
        "imported full fixture": jsonResumeToResume(full).resume,
        "imported minimal fixture": jsonResumeToResume(minimal).resume,
    };

    for (const [name, resume] of Object.entries(cases)) {
        it(`validates ${name}`, () => {
            for (const includePhoto of [false, true]) {
                const { document } = resumeToJsonResume(resume, { includePhoto });
                const result = validator.safeParse(document);
                expect(result.success, JSON.stringify(result.success ? null : result.error.issues.slice(0, 3))).toBe(true);
            }
        });
    }
});
