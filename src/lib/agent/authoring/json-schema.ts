import { z } from "zod";
import { AUTHORING_SCHEMA_URL, authoringV1Schema } from "./schema";

/**
 * The published JSON Schema, generated from the same Zod definition the
 * importer uses (FR-011). Served at /schema/authoring/v1.json.
 */
export function buildAuthoringJsonSchema(): Record<string, unknown> {
    const generated = z.toJSONSchema(authoringV1Schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
    const { $schema, ...rest } = generated;
    return {
        $schema,
        $id: AUTHORING_SCHEMA_URL,
        title: "EngineCV authoring format v1",
        description:
            "A CV as content only, for AIs and scripts to read and write. Every field is optional except "
            + "\"format\"; leave out anything unknown rather than inventing it. EngineCV imports it through "
            + "\"Paste from AI\" and reports every value it had to adjust.",
        ...rest,
    };
}
