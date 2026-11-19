import { describe, expect, it } from "vitest";
import { makeCv, makeLetter } from "../../../test/setup/letter-fixtures";
import { letterFileBaseName } from "./file-name";
import { resolveLetter } from "./resolve";

const name = (overrides = {}) => letterFileBaseName(resolveLetter(makeLetter(overrides), makeCv()));

describe("letterFileBaseName", () => {
    it("builds a lowercase stem from company and role", () => {
        expect(name({ company: "Acme GmbH", role: "Senior Designer" })).toBe("cover-letter-acme-gmbh-senior-designer");
    });
    it("drops accents and punctuation, and never ends in a dash", () => {
        expect(name({ company: "Café Müller & Söhne!", role: "" })).toBe("cover-letter-cafe-muller-sohne");
    });
    it("falls back when there is nothing to name it by, and stays short", () => {
        expect(name({ company: "", role: "" })).toBe("cover-letter");
        expect(name({ company: "x".repeat(200), role: "y" }).length).toBeLessThanOrEqual(80);
    });
});
