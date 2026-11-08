import { describe, expect, it } from "vitest";
import { en } from "./en";
import { bs } from "./bs";
import { de } from "./de";
import { fr } from "./fr";
import { es } from "./es";

const LANGUAGES_SECTION_KEYS = [
    "customize.languagesSection",
    "customize.languagesLayout",
    "customize.languagesColumns",
    "customize.languagesColumnGap",
    "customize.languagesCustomItemSpacing",
    "customize.languagesItemSpacing",
    "customize.languagesTablePaddingX",
    "customize.languagesTablePaddingY",
    "customize.languagesFluency",
    "customize.languagesFluencyBadge",
    "customize.languagesFluencyText",
    "customize.languagesFluencyHidden",
    "customize.languagesFluencySize",
    "customize.languagesFluencyPlacement",
    "customize.languagesFluencyOrder",
    "customize.languagesOrderLanguageFirst",
    "customize.languagesOrderFluencyFirst",
] as const;

describe("languages section customization translations", () => {
    const locales = { en, bs, de, fr, es };

    for (const [locale, translations] of Object.entries(locales)) {
        it(`defines every languages-section key in "${locale}"`, () => {
            for (const key of LANGUAGES_SECTION_KEYS) {
                expect((translations as Record<string, string>)[key], `${locale} missing ${key}`).toBeTruthy();
            }
        });
    }
});
