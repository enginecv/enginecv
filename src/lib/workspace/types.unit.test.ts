import { describe, expect, it } from "vitest";
import { bs } from "@/lib/i18n/bs";
import { de } from "@/lib/i18n/de";
import { en } from "@/lib/i18n/en";
import { es } from "@/lib/i18n/es";
import { fr } from "@/lib/i18n/fr";
import { REASON_CODES } from "./types";

describe("workspace reason codes", () => {
    it("have one line of copy in every locale", () => {
        for (const [name, dictionary] of Object.entries({ en, de, fr, es, bs })) {
            const missing = REASON_CODES.filter((code) => !dictionary[`workspace.reason.${code}`]);
            expect(missing, name).toEqual([]);
        }
    });

    it("are unique", () => {
        expect(new Set(REASON_CODES).size).toBe(REASON_CODES.length);
    });
});
