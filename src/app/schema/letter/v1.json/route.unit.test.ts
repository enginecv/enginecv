import { describe, expect, it } from "vitest";
import { buildLetterJsonSchema, LETTER_SCHEMA_URL } from "@/lib/letters/file-format";
import { dynamic, GET } from "./route";

describe("GET /schema/letter/v1.json", () => {
    it("serves the schema the letter reader is built from", async () => {
        const response = GET();
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual(buildLetterJsonSchema());
        expect(body.$id).toBe(LETTER_SCHEMA_URL);
        expect(Object.keys(body.properties)).toEqual(expect.arrayContaining(["id", "status", "cv", "standalone", "paragraphs", "recipient", "sender", "design"]));
    });

    it("is static, cacheable and readable from any origin", () => {
        const response = GET();
        expect(dynamic).toBe("force-static");
        expect(response.headers.get("Content-Type")).toBe("application/schema+json; charset=utf-8");
        expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("lives at the path its $id names", () => {
        expect(new URL(LETTER_SCHEMA_URL).pathname).toBe("/schema/letter/v1.json");
    });
});
