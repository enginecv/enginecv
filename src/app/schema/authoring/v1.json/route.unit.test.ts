import { describe, expect, it } from "vitest";
import { buildAuthoringJsonSchema } from "@/lib/agent/authoring/json-schema";
import { AUTHORING_SCHEMA_URL } from "@/lib/agent/authoring/schema";
import { dynamic, GET } from "./route";

describe("GET /schema/authoring/v1.json", () => {
    it("serves the schema the importer is built from", async () => {
        const response = GET();
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual(buildAuthoringJsonSchema());
        expect(body.$id).toBe(AUTHORING_SCHEMA_URL);
    });

    it("is static, cacheable and readable from any origin", () => {
        const response = GET();
        expect(dynamic).toBe("force-static");
        expect(response.headers.get("Content-Type")).toBe("application/schema+json; charset=utf-8");
        expect(response.headers.get("Cache-Control")).toBe("public, max-age=86400");
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("lives at the path its $id names", () => {
        expect(new URL(AUTHORING_SCHEMA_URL).pathname).toBe("/schema/authoring/v1.json");
    });
});
