import { describe, expect, it } from "vitest";
import { QA_RESUME_FIXTURES } from "@/lib/qa/sample-resumes";
import { resumeToAuthoring } from "./from-resume";
import { buildAuthoringJsonSchema } from "./json-schema";
import { AUTHORING_SCHEMA_URL, AUTHORING_SECTION_KEYS, authoringV1Schema } from "./schema";

describe("published JSON Schema (FR-010, FR-011)", () => {
    const schema = buildAuthoringJsonSchema() as {
        $id: string;
        $schema: string;
        title: string;
        required: string[];
        properties: Record<string, { description?: string }>;
    };

    it("is identified by its published URL", () => {
        expect(schema.$id).toBe(AUTHORING_SCHEMA_URL);
        expect(schema.$schema).toMatch(/json-schema\.org/);
        expect(schema.title).toBeTruthy();
    });

    it("requires only the format marker", () => {
        expect(schema.required).toEqual(["format"]);
    });

    it("describes every top-level section", () => {
        for (const key of ["format", "design", "basics", "summary", ...AUTHORING_SECTION_KEYS]) {
            expect(schema.properties, key).toHaveProperty(key);
        }
    });

    it("carries field descriptions for AIs", () => {
        const text = JSON.stringify(schema);
        expect(text).toContain("YYYY-MM");
        expect(text).toContain("Job title.");
    });

    it("is deterministic", () => {
        expect(JSON.stringify(buildAuthoringJsonSchema())).toBe(JSON.stringify(schema));
    });

    for (const fixture of QA_RESUME_FIXTURES) {
        it(`accepts the canonical output of ${fixture.id}`, () => {
            for (const options of [{}, { ids: true, personal: true }]) {
                const result = authoringV1Schema.safeParse(resumeToAuthoring(fixture.create(), options));
                expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
            }
        });
    }
});
