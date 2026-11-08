import { describe, expect, it } from "vitest";
import { isLegalNoticeReady, missingLegalOperatorFields, type LegalOperator } from "./legal-operator";

const empty: LegalOperator = {
    name: null,
    street: null,
    postalCodeAndCity: null,
    country: null,
    email: null,
    phone: null,
    vatId: null,
    responsibleForContent: null,
};

describe("legal notice readiness", () => {
    it("is not ready while any required field is missing or blank", () => {
        expect(isLegalNoticeReady(empty)).toBe(false);
        expect(missingLegalOperatorFields({ ...empty, name: "A", street: "  " })).toEqual([
            "street",
            "postalCodeAndCity",
            "country",
            "email",
        ]);
    });

    it("is ready once name, address, country and email are present; phone and VAT stay optional", () => {
        expect(
            isLegalNoticeReady({
                ...empty,
                name: "A",
                street: "B 1",
                postalCodeAndCity: "1010 Wien",
                country: "Austria",
                email: "a@example.com",
            }),
        ).toBe(true);
    });
});
