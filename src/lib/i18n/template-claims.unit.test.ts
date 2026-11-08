import { describe, expect, it } from "vitest";
import { getBuiltinTemplates } from "@/lib/templates/enginecv-templates";
import { bs } from "./bs";
import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";

// Public copy about template text extraction states how many templates were
// checked, so it is fed from the template registry and cannot drift from what
// ships. The measurement itself is the parse report the e2e `parse` project writes,
// produced by e2e/parse-pdf.spec.ts.
const LOCALES = { en, bs, de, fr, es } as const;

/** "ATS" as a word, so it does not fire on "automatskim" and friends. */
const ATS_CLAIM = /(^|[^A-Za-z])ATS([^A-Za-z]|$)/;

const CLAIM_KEYS = [
    "landing.features.atsTemplates",
    "landing.features.atsTemplatesDesc",
    "export.downloadSidecarHint",
] as const;

describe("template parse claims", () => {
    it.each(Object.entries(LOCALES))("%s: the claim counts templates from the registry", (_locale, dictionary) => {
        const claim = dictionary["landing.features.atsTemplatesDesc"];
        expect(claim).toContain("{templateCount}");
        expect(claim).not.toMatch(/[0-9]/);
    });

    it.each(Object.entries(LOCALES))("%s: no copy promises ATS compatibility", (_locale, dictionary) => {
        for (const key of CLAIM_KEYS) {
            expect(dictionary[key], key).not.toMatch(ATS_CLAIM);
        }
    });

    it("has templates to count", () => {
        expect(getBuiltinTemplates().length).toBeGreaterThan(0);
    });
});
