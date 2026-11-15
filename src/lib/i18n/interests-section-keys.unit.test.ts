import { describe, expect, it } from "vitest";
import { en } from "./en";
import { bs } from "./bs";
import { de } from "./de";
import { fr } from "./fr";
import { es } from "./es";

const INTERESTS_SECTION_KEYS = [
    "customize.interestsSection",
    "customize.interestsStyle",
    "customize.interestsStyleList",
    "customize.interestsStyleInline",
    "customize.interestsStyleChips",
    "customize.interestsStyleIconGrid",
    "customize.interestsShowIcons",
    "customize.interestsSeparator",
    "customize.interestsSeparatorDot",
    "customize.interestsSeparatorComma",
    "customize.interestsSeparatorPipe",
    "customize.interestsSeparatorSlash",
    "customize.interestsColumns",
    "customize.interestsDescriptionsHidden",
] as const;

describe("interests section customization translations", () => {
    const locales = { en, bs, de, fr, es };

    for (const [locale, translations] of Object.entries(locales)) {
        it(`defines every interests-section key in "${locale}"`, () => {
            for (const key of INTERESTS_SECTION_KEYS) {
                expect((translations as Record<string, string>)[key], `${locale} missing ${key}`).toBeTruthy();
            }
        });
    }

    it("translates the style names instead of copying English (non-English locales)", () => {
        for (const [locale, translations] of Object.entries({ bs, de, fr, es })) {
            const t = translations as Record<string, string>;
            expect(t["customize.interestsShowIcons"], locale).not.toBe(en["customize.interestsShowIcons"]);
            expect(t["customize.interestsDescriptionsHidden"], locale).not.toBe(en["customize.interestsDescriptionsHidden"]);
        }
    });
});

const INTEREST_ICON_KEYS = [
    "editor.interestIcon",
    "editor.interestIconNone",
    "editor.interestIconChoose",
    "editor.interestIconSearch",
    "editor.interestIconSearchPlaceholder",
    "editor.interestIconEmpty",
    "editor.interestIconEmojiLabel",
    "editor.interestIconEmojiPlaceholder",
    "editor.interestIconEmojiInvalid",
    "editor.interestIconClear",
] as const;

describe("interest icon field translations", () => {
    const locales = { en, bs, de, fr, es };

    for (const [locale, translations] of Object.entries(locales)) {
        it(`defines every interest icon key in "${locale}"`, () => {
            for (const key of INTEREST_ICON_KEYS) {
                expect((translations as Record<string, string>)[key], `${locale} missing ${key}`).toBeTruthy();
            }
        });
    }
});
