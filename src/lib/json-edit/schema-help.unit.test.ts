import { describe, expect, it } from "vitest";
import { experienceSchema } from "@/lib/schema";
import { buildResumeJsonSchema, completionsAt, describeType, schemaAt } from "./schema-help";

describe("schema-derived JSON help", () => {
    it("builds and caches the input schema within budget", () => {
        const start = performance.now();
        const schema = buildResumeJsonSchema();
        const elapsed = performance.now() - start;
        expect(schema.properties?.experience).toBeTruthy();
        expect(buildResumeJsonSchema()).toBe(schema);
        expect(elapsed).toBeLessThan(50);
    });
    it("offers only missing experience fields", () => {
        const result = completionsAt(buildResumeJsonSchema(), ["experience", 0], ["id", "company"]);
        expect(result.map(item => item.key).sort()).toEqual(Object.keys(experienceSchema.shape).filter(key => !["id", "company"].includes(key)).sort());
        expect(result.every(item => item.type)).toBe(true);
    });
    it("resolves references, nullable branches and enum values", () => {
        const schema = { $defs: { entry: { type: "object", properties: { name: { type: "string" } } } }, properties: { entries: { anyOf: [{ type: "array", items: { $ref: "#/$defs/entry" } }, { type: "null" }] } } };
        expect(schemaAt(schema, ["entries", 0, "name"])).toEqual({ type: "string" });
        expect(describeType({ enum: ["a4", "letter"] })).toEqual({ kind: "enum", values: ["a4", "letter"] });
    });
    it("describes strings, arrays of objects and schema enums", () => {
        const schema = buildResumeJsonSchema();
        expect(describeType(schemaAt(schema, ["experience", 0, "position"])!)).toEqual({ kind: "string" });
        expect(describeType(schemaAt(schema, ["experience"])!)).toMatchObject({ kind: "array", item: { kind: "object" } });
        const node = schemaAt(schema, ["settings", "theme"])!;
        expect(node).toBeTruthy();
        expect(completionsAt(schema, ["settings", "layout", "columns"], []).map(item => item.key)).toContain('"one"');
    });
});
