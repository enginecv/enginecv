import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createQaFullResume } from "@/lib/qa/sample-resumes";
import { MAX_AUTHORING_TEXT_BYTES, parseAuthoringText } from "./parse-text";
import { repairJsonText } from "./parse-text";

const DOC = '{"format":"enginecv.authoring/v1","basics":{"name":"Amina"}}';
const codes = (text: string) => parseAuthoringText(text).notices.map((notice) => notice.code);

describe("repairJsonText", () => {
    it("uses the caller's byte cap, including multibyte input", () => {
        expect(repairJsonText('{"a":"é"}', { maxBytes: 9 }).status).toBe("blocked");
        const text = JSON.stringify(createQaFullResume());
        expect(repairJsonText(text, { maxBytes: 2 * 1024 * 1024 }).status).toBe("ok");
    });
    it("returns exactly the repaired source that was parsed, without full-export routing", () => {
        const result = repairJsonText('```json\n{settings: {},}\n```', { maxBytes: 1024 });
        expect(result.status).toBe("ok");
        if (result.status === "ok") {
            expect(JSON.parse(result.text)).toEqual(result.value);
            expect(result.value).toEqual({ settings: {} });
            expect(result.notices.map(n => n.code)).toEqual(["code-fence", "trailing-comma", "unquoted-keys"]);
        }
    });
});

describe("parseAuthoringText", () => {
    it("blocks empty and oversized input", () => {
        expect(parseAuthoringText("  \n ")).toMatchObject({ status: "blocked", error: { code: "empty" } });
        const big = `{"summary":"${"x".repeat(MAX_AUTHORING_TEXT_BYTES)}"}`;
        expect(parseAuthoringText(big)).toMatchObject({ status: "blocked", error: { code: "too-large" } });
    });

    it("blocks text without an object", () => {
        expect(parseAuthoringText("Sorry, I can't help with that.")).toMatchObject({
            status: "blocked",
            error: { code: "no-document" },
        });
        expect(parseAuthoringText("[1, 2, 3]").error?.code).toBe("no-document");
    });

    it("reads plain JSON without notices", () => {
        expect(parseAuthoringText(DOC)).toEqual({
            status: "ok",
            document: { format: "enginecv.authoring/v1", basics: { name: "Amina" } },
            notices: [],
        });
    });

    it("strips a BOM silently", () => {
        expect(parseAuthoringText(`﻿${DOC}`)).toMatchObject({ status: "ok", notices: [] });
    });

    it("takes the document out of a ```json fence and reports the prose", () => {
        const result = parseAuthoringText(`Here is your CV:\n\n\`\`\`json\n${DOC}\n\`\`\`\n\nLet me know!`);
        expect(result.status).toBe("ok");
        expect(result.notices.map((notice) => notice.code)).toEqual(["code-fence", "surrounding-text"]);
        expect(result.notices.every((notice) => notice.kind === "repaired" && notice.path === "(document)")).toBe(true);
    });

    it("reads a fence without a language and a fence the answer never closed", () => {
        expect(codes(`\`\`\`\n${DOC}\n\`\`\``)).toEqual(["code-fence"]);
        expect(parseAuthoringText(`\`\`\`json\n${DOC}`).status).toBe("ok");
    });

    it("finds the object inside prose", () => {
        const result = parseAuthoringText(`Sure! ${DOC} Hope this helps {or not}.`);
        expect(result.status).toBe("ok");
        expect(result.notices.map((notice) => notice.code)).toEqual(["surrounding-text"]);
    });

    it("uses the first of two documents and says so", () => {
        const second = '{"format":"enginecv.authoring/v1","basics":{"name":"Other"}}';
        const result = parseAuthoringText(`${DOC}\n\nOr shorter:\n${second}`);
        expect(result.document).toMatchObject({ basics: { name: "Amina" } });
        expect(result.notices.map((notice) => notice.code)).toContain("multiple-documents");

        const fenced = parseAuthoringText(`\`\`\`json\n${DOC}\n\`\`\`\n\`\`\`json\n${second}\n\`\`\``);
        expect(fenced.document).toMatchObject({ basics: { name: "Amina" } });
        expect(fenced.notices.map((notice) => notice.code)).toContain("multiple-documents");
    });

    it("ignores braces inside strings when finding the object", () => {
        const result = parseAuthoringText('{"summary":"Uses {braces} and \\"quotes\\" }"}');
        expect(result.document).toEqual({ summary: 'Uses {braces} and "quotes" }' });
    });

    it("repairs trailing commas", () => {
        const result = parseAuthoringText('{"basics":{"name":"A",},"skills":["Go","Rust",],}');
        expect(result.document).toEqual({ basics: { name: "A" }, skills: ["Go", "Rust"] });
        expect(result.notices.map((notice) => notice.code)).toEqual(["trailing-comma"]);
    });

    it("repairs smart quotes outside strings and leaves them inside strings", () => {
        const result = parseAuthoringText("{“basics”: {“name”: “Amina”}, \"summary\": \"She said “hi”\"}");
        expect(result.document).toEqual({ basics: { name: "Amina" }, summary: "She said “hi”" });
        expect(result.notices.map((notice) => notice.code)).toEqual(["smart-quotes"]);
    });

    it("removes comments", () => {
        const result = parseAuthoringText('{\n  // the person\n  "basics": {"name": "A"}, /* later */ "summary": "a // not a comment"\n}');
        expect(result.document).toEqual({ basics: { name: "A" }, summary: "a // not a comment" });
        expect(result.notices.map((notice) => notice.code)).toEqual(["comments"]);
    });

    it("quotes unquoted keys", () => {
        const result = parseAuthoringText('{format: "enginecv.authoring/v1", basics: {name: "A", headline: "true: story"}}');
        expect(result.document).toEqual({ format: "enginecv.authoring/v1", basics: { name: "A", headline: "true: story" } });
        expect(result.notices.map((notice) => notice.code)).toEqual(["unquoted-keys"]);
    });

    it("applies several repairs together, each noted once", () => {
        const text = "Here you go:\n```json\n{\n  // CV\n  basics: {“name”: \"A\",},\n}\n```";
        const result = parseAuthoringText(text);
        expect(result.status).toBe("ok");
        expect(result.notices.map((notice) => notice.code)).toEqual([
            "code-fence", "surrounding-text", "smart-quotes", "comments", "trailing-comma", "unquoted-keys",
        ]);
    });

    it("reports invalid JSON with line and column in the pasted text", () => {
        const text = 'Answer:\n{\n  "basics": {\n    "name": "A" "headline": "B"\n  }\n}';
        const result = parseAuthoringText(text);
        expect(result.status).toBe("blocked");
        expect(result.error).toMatchObject({ code: "invalid-json", line: 4 });
        expect(result.error?.column).toBeGreaterThan(10);
    });

    it("hands a full EngineCV export to the existing import", () => {
        const result = parseAuthoringText(JSON.stringify(createQaFullResume()));
        expect(result.status).toBe("full-export");
        expect(result.document).toBeTruthy();
        expect(parseAuthoringText('{"format":"enginecv/encrypted-json","ciphertext":"x"}').status).toBe("full-export");
    });

    it("accepts a document without a format marker (authoringToResume reports it)", () => {
        expect(parseAuthoringText('{"basics":{"name":"A"},"experience":[]}')).toMatchObject({ status: "ok", notices: [] });
    });
});

describe("real AI answers", () => {
    const dir = join(__dirname, "__fixtures__", "ai-answers");
    const files = readdirSync(dir).filter((file) => file.endsWith(".txt"));

    it.skipIf(files.length === 0)("parses every captured answer", () => {
        for (const file of files) {
            const result = parseAuthoringText(readFileSync(join(dir, file), "utf8"));
            expect(result.status, file).toBe("ok");
        }
    });
});
