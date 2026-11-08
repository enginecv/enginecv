import { describe, expect, it } from "vitest";
import { bs } from "@/lib/i18n/bs";
import { de } from "@/lib/i18n/de";
import { en } from "@/lib/i18n/en";
import { es } from "@/lib/i18n/es";
import { fr } from "@/lib/i18n/fr";
import { AUTHORING_EXAMPLE, buildAiInstructions, buildFieldOverview, type Translate } from "./instructions";
import { parseAuthoringText } from "./parse-text";
import { AUTHORING_SCHEMA_URL, BASICS_FIELDS, LIST_SECTION_KEYS, SECTION_ENTRY_SPECS } from "./schema";
import { authoringToResume } from "./to-resume";

const DICTIONARIES = { en, de, bs, fr, es };

function translator(dictionary: Record<string, string>): Translate {
    return (key, params) => {
        const text = dictionary[key];
        if (text === undefined) throw new Error(`missing ${key}`);
        return Object.entries(params ?? {}).reduce((out, [name, value]) => out.replace(`{${name}}`, String(value)), text);
    };
}

describe("buildAiInstructions (FR-018)", () => {
    for (const [locale, dictionary] of Object.entries(DICTIONARIES)) {
        describe(locale, () => {
            const text = buildAiInstructions(translator(dictionary));

            it("states every rule in the UI language", () => {
                for (const key of ["intro", "rule.oneBlock", "rule.format", "rule.noInvent", "rule.wording", "rule.dates", "rule.language", "notesTitle"]) {
                    expect(text, key).toContain(dictionary[`authoring.instructions.${key}`]);
                }
            });

            it("carries the field overview, the example and the schema URL", () => {
                expect(text).toContain(buildFieldOverview());
                expect(text).toContain(JSON.stringify(AUTHORING_EXAMPLE, null, 2));
                expect(text).toContain(AUTHORING_SCHEMA_URL);
                expect(text).not.toMatch(/\{(url|line|column)\}/);
            });

            it("stays short enough to paste anywhere", () => {
                expect(new TextEncoder().encode(text).length).toBeLessThan(5000);
            });
        });
    }

    it("is written in the UI language, not English, outside the neutral parts", () => {
        const german = buildAiInstructions(translator(de));
        expect(german).toContain("Erfinde niemals Arbeitgeber");
        expect(german).not.toContain("Never invent");
    });

    it("lists every field the importer knows, except ids and hidden", () => {
        const overview = buildFieldOverview();
        for (const field of Object.keys(BASICS_FIELDS)) expect(overview).toContain(field);
        for (const key of LIST_SECTION_KEYS) {
            for (const field of Object.keys(SECTION_ENTRY_SPECS[key].fields)) {
                if (field === "id" || field === "hidden") continue;
                expect(overview, `${key}.${field}`).toContain(field);
            }
        }
        expect(overview).not.toMatch(/\bid\b/);
    });

    it("has an example that imports without a single notice", () => {
        const result = authoringToResume(AUTHORING_EXAMPLE);
        expect(result.notices).toEqual([]);
        expect(result.designApplied).toEqual({ template: "enginecv-modern", accent: "#1f3a5f", cvLanguage: "de" });
    });

    it("produces an answer shape the parser reads straight back", () => {
        // An assistant that echoes the example block verbatim must import cleanly.
        const echoed = buildAiInstructions(translator(en)).split("```json\n")[1].split("\n```")[0];
        const parsed = parseAuthoringText(echoed);
        expect(parsed).toMatchObject({ status: "ok", notices: [] });
    });
});
