export const MARITAL_STATUS_KEYS = [
    "single",
    "inRelationship",
    "engaged",
    "married",
    "civilPartnership",
    "domesticPartnership",
    "separated",
    "divorced",
    "widowed",
    "preferNotToSay",
] as const;

export type MaritalStatusKey = (typeof MARITAL_STATUS_KEYS)[number];

const TRANSLATIONS: Record<string, Partial<Record<MaritalStatusKey, string>>> = {
    en: {
        single: "Single",
        inRelationship: "In a relationship",
        engaged: "Engaged",
        married: "Married",
        civilPartnership: "Civil partnership",
        domesticPartnership: "Domestic partnership",
        separated: "Separated",
        divorced: "Divorced",
        widowed: "Widowed",
        preferNotToSay: "Prefer not to say",
    },
    bs: {
        single: "Slobodan/Slobodna",
        inRelationship: "U vezi",
        engaged: "Zaručen/Zaručena",
        married: "Oženjen/Udata",
        civilPartnership: "Civilno partnerstvo",
        domesticPartnership: "Domaće partnerstvo",
        separated: "Razdvojen/Razdvojena",
        divorced: "Razveden/Razvedena",
        widowed: "Udovac/Udovica",
        preferNotToSay: "Ne želim odgovoriti",
    },
    de: {
        single: "Ledig",
        inRelationship: "In einer Beziehung",
        engaged: "Verlobt",
        married: "Verheiratet",
        civilPartnership: "Eingetragene Lebenspartnerschaft",
        domesticPartnership: "Lebensgemeinschaft",
        separated: "Getrennt lebend",
        divorced: "Geschieden",
        widowed: "Verwitwet",
        preferNotToSay: "Keine Angabe",
    },
    fr: {
        single: "Célibataire",
        inRelationship: "En couple",
        engaged: "Fiancé(e)",
        married: "Marié(e)",
        civilPartnership: "Partenariat civil",
        domesticPartnership: "Union libre",
        separated: "Séparé(e)",
        divorced: "Divorcé(e)",
        widowed: "Veuf/Veuve",
        preferNotToSay: "Ne souhaite pas répondre",
    },
    es: {
        single: "Soltero/a",
        inRelationship: "En una relación",
        engaged: "Prometido/a",
        married: "Casado/a",
        civilPartnership: "Pareja civil",
        domesticPartnership: "Pareja de hecho",
        separated: "Separado/a",
        divorced: "Divorciado/a",
        widowed: "Viudo/a",
        preferNotToSay: "Prefiero no responder",
    },
};

const ALIAS: Record<string, MaritalStatusKey> = {
    // English aliases
    single: "single",
    married: "married",
    divorced: "divorced",
    widowed: "widowed",
    separated: "separated",
    engaged: "engaged",
    "in a relationship": "inRelationship",
    "civil partnership": "civilPartnership",
    "in a civil partnership": "civilPartnership",
    "domestic partnership": "domesticPartnership",
    "prefer not to say": "preferNotToSay",
    "n/a": "preferNotToSay",
    // German
    ledig: "single",
    verheiratet: "married",
    geschieden: "divorced",
    verwitwet: "widowed",
};

export function normalizeMaritalStatus(value: string): MaritalStatusKey | string {
    if (!value) return "";
    if ((MARITAL_STATUS_KEYS as readonly string[]).includes(value)) {
        return value as MaritalStatusKey;
    }
    const hit = ALIAS[value.trim().toLowerCase()];
    return hit ?? value;
}

export function isMaritalStatusKey(value: string): value is MaritalStatusKey {
    return (MARITAL_STATUS_KEYS as readonly string[]).includes(value);
}

export function getMaritalStatusLabel(key: string, language: string = "en"): string {
    if (!isMaritalStatusKey(key)) return key;
    const localized = TRANSLATIONS[language]?.[key];
    if (localized) return localized;
    return TRANSLATIONS.en[key] ?? key;
}

/** Returns true if this value should render nothing in the CV preview. */
export function isHiddenMaritalStatus(value: string): boolean {
    return value === "preferNotToSay";
}
