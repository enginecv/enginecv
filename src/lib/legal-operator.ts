/**
 * Provider identification for the Impressum / legal notice (DE §5 DDG,
 * AT §5 ECG and §25 MedienG). Fill every required field before the page goes
 * live: until then /impressum is noindex, stays out of the sitemap and is not
 * linked from the footer. Which law applies depends on where the operator is
 * established, so have the final text checked.
 */
export interface LegalOperator {
    name: string | null;
    street: string | null;
    postalCodeAndCity: string | null;
    country: string | null;
    email: string | null;
    phone: string | null;
    /** VAT identification number, if the operator has one. */
    vatId: string | null;
    /** Person responsible for editorial content (§18 Abs. 2 MStV in Germany). */
    responsibleForContent: string | null;
}

export const LEGAL_OPERATOR: LegalOperator = {
    name: "Safet Imamović",
    street: "Dr. Ćire Truhelke 10c",
    postalCodeAndCity: "72000 Zenica",
    country: "Bosnia and Herzegovina",
    email: "safet@enginecv.app",
    phone: null,
    vatId: null,
    responsibleForContent: "Safet Imamović",
};

const REQUIRED_FIELDS = ["name", "street", "postalCodeAndCity", "country", "email"] as const;

export function missingLegalOperatorFields(operator: LegalOperator = LEGAL_OPERATOR) {
    return REQUIRED_FIELDS.filter((field) => !operator[field]?.trim());
}

export function isLegalNoticeReady(operator: LegalOperator = LEGAL_OPERATOR) {
    return missingLegalOperatorFields(operator).length === 0;
}
