import { describe, expect, it } from "vitest";
import { EXPORT_FORMATS, getExportFormatClaimParams, getExportFormatCount } from "@/lib/export-formats";
import { bs } from "./bs";
import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";

// Public copy that states how many export formats exist, or lists them, must be
// fed from the format registry so it cannot drift from what the product offers.
const FORMAT_CLAIM_KEYS = {
    "landing.hero.badgePdf": "{formatCount}",
    "landing.hero.modeSyncDesc": "{formats}",
    "landing.free.exportFormats": "{formats}",
    "landing.noLockin.exportAnytimeDesc": "{formats}",
    "landing.faq.a4": "{formats}",
} as const;

const LOCALES = { en, bs, de, fr, es } as const;

function render(template: string, params: Record<string, string | number>) {
    return Object.entries(params).reduce((text, [key, value]) => text.replace(`{${key}}`, String(value)), template);
}

describe("export format claims", () => {
    it.each(Object.entries(LOCALES))("%s: every format claim uses the registry placeholder", (_locale, dictionary) => {
        for (const [key, placeholder] of Object.entries(FORMAT_CLAIM_KEYS)) {
            expect(dictionary[key], key).toContain(placeholder);
            expect(dictionary[key], key).not.toMatch(/\b\d+\b/);
        }
    });

    it.each(Object.entries(LOCALES))("%s: rendered claims state the registry count and every format", (_locale, dictionary) => {
        const translate = (key: string) => dictionary[key] ?? en[key];
        const params = getExportFormatClaimParams(translate);

        expect(render(dictionary["landing.hero.badgePdf"], params)).toContain(String(getExportFormatCount()));
        const listed = render(dictionary["landing.faq.a4"], params);
        for (const format of EXPORT_FORMATS) {
            expect(listed).toContain(translate(format.labelKey));
        }
    });
});
