import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/en";
import { bs } from "@/lib/i18n/bs";
import { de } from "@/lib/i18n/de";
import { fr } from "@/lib/i18n/fr";
import { es } from "@/lib/i18n/es";
import { TOOL_SLUGS, getEnabledTools, getTool, getTools, relatedTools, toolPath, type ToolDefinition } from "@/lib/tools/registry";

const DICTIONARIES: Record<string, Record<string, string>> = { en, de, bs, fr, es };

function referencedKeys(tool: ToolDefinition): string[] {
    const { keyPrefix } = tool;
    return [
        `${keyPrefix}.metaTitle`,
        `${keyPrefix}.metaDescription`,
        `${keyPrefix}.title`,
        `${keyPrefix}.intro`,
        `${keyPrefix}.card`,
        `${keyPrefix}.privacy`,
        ...Array.from({ length: tool.stepCount }, (_, i) => `${keyPrefix}.steps.${i + 1}`),
        ...tool.faq.flatMap(({ q, a }) => [q, a]),
    ];
}

describe("tool registry", () => {
    it("lists every slug once, in TOOL_SLUGS order, with URL-safe slugs", () => {
        expect(getTools().map((tool) => tool.slug)).toEqual([...TOOL_SLUGS]);
        for (const slug of TOOL_SLUGS) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    });

    it("keeps each FAQ between three and six questions", () => {
        for (const tool of getTools()) {
            expect(tool.faq.length).toBeGreaterThanOrEqual(3);
            expect(tool.faq.length).toBeLessThanOrEqual(6);
        }
    });

    // Disabled tools may still be waiting for their copy; enabled ones ship.
    it.each(getEnabledTools().map((tool) => [tool.slug, tool] as const))("%s has every key in every locale", (_slug, tool) => {
        for (const [locale, dictionary] of Object.entries(DICTIONARIES)) {
            const missing = referencedKeys(tool).filter((key) => !dictionary[key]?.trim());
            expect(missing, `${locale} is missing keys`).toEqual([]);
        }
    });

    it("hides disabled tools from lookups and related links", () => {
        const disabled = getTools().find((tool) => !tool.enabled);
        if (!disabled) return;
        expect(getTool(disabled.slug)).toBeUndefined();
        for (const tool of getEnabledTools()) {
            expect(relatedTools(tool.slug).map((related) => related.slug)).not.toContain(disabled.slug);
        }
    });

    it("builds paths under /tools", () => {
        expect(toolPath("cefr-level")).toBe("/tools/cefr-level");
    });
});
