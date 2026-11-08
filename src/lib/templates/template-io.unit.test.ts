import { describe, expect, it } from "vitest";
import { createEmptyResume } from "../schema";
import {
    exportTemplateToJson,
    importTemplateFromJsonText,
} from "./template-io";
import {
    type TemplateDocument,
    TEMPLATE_DOCUMENT_VERSION,
} from "./template-schema";

function makeTemplate(): TemplateDocument {
    const settings = createEmptyResume().settings;
    const now = 12345678;
    return {
        kind: "template",
        id: "tpl-io",
        version: TEMPLATE_DOCUMENT_VERSION,
        meta: {
            name: "Round-trip",
            description: "Round-trip test",
            tags: ["Modern"],
            source: "user",
        },
        settings,
        paperSize: "letter",
        createdAt: now,
        updatedAt: now,
    };
}

describe("template-io", () => {
    it("round-trips a template through JSON export/import", () => {
        const template = makeTemplate();
        const json = exportTemplateToJson(template);
        const parsed = importTemplateFromJsonText(json);
        expect(parsed.id).toBe(template.id);
        expect(parsed.meta.name).toBe(template.meta.name);
        expect(parsed.meta.tags).toEqual(template.meta.tags);
        expect(parsed.paperSize).toBe(template.paperSize);
        expect(parsed.settings.colors.accent).toBe(template.settings.colors.accent);
    });

    it("rejects JSON without the template discriminator", () => {
        const json = JSON.stringify({ kind: "resume", basics: {}, settings: {} });
        expect(() => importTemplateFromJsonText(json)).toThrow(/not a template/);
    });

    it("rejects malformed JSON", () => {
        expect(() => importTemplateFromJsonText("not json")).toThrow(/valid JSON/);
    });
});
