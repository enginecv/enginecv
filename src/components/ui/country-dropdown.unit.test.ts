import { describe, expect, it } from "vitest";
import { countryDisplayText, parseCountryTokens } from "./country-dropdown";

describe("countryDisplayText", () => {
    it("renders localized nationality wording when requested", () => {
        const [serbia] = parseCountryTokens("Serbia");
        const [bosnia] = parseCountryTokens("Bosnia and Herzegovina");

        expect(countryDisplayText(serbia, "name", { nameStyle: "nationality", language: "bs" })).toBe("Srpsko");
        expect(countryDisplayText(bosnia, "name", { nameStyle: "nationality", language: "bs" })).toBe("Bosansko");
    });
});
