export const DISABILITY_KEYS = [
    "none",
    "visual",
    "hearing",
    "mobility",
    "chronic",
    "cognitive",
    "mentalHealth",
    "neurodivergent",
    "speech",
    "other",
    "preferNotToSay",
] as const;

export type DisabilityKey = (typeof DISABILITY_KEYS)[number];

const TRANSLATIONS: Record<string, Partial<Record<DisabilityKey, string>>> = {
    en: {
        none: "No disability",
        visual: "Visual impairment",
        hearing: "Hearing impairment",
        mobility: "Mobility / Physical",
        chronic: "Chronic illness",
        cognitive: "Cognitive / Learning",
        mentalHealth: "Mental health condition",
        neurodivergent: "Neurodivergent",
        speech: "Speech impairment",
        other: "Other",
        preferNotToSay: "Prefer not to say",
    },
    bs: {
        none: "Bez invaliditeta",
        visual: "Oštećenje vida",
        hearing: "Oštećenje sluha",
        mobility: "Tjelesni invaliditet",
        chronic: "Hronična bolest",
        cognitive: "Kognitivne poteškoće",
        mentalHealth: "Mentalno zdravlje",
        neurodivergent: "Neurodivergentnost",
        speech: "Govorne poteškoće",
        other: "Ostalo",
        preferNotToSay: "Ne želim odgovoriti",
    },
    de: {
        none: "Keine Behinderung",
        visual: "Sehbehinderung",
        hearing: "Hörbehinderung",
        mobility: "Körperliche Behinderung",
        chronic: "Chronische Erkrankung",
        cognitive: "Lern-/kognitive Behinderung",
        mentalHealth: "Psychische Erkrankung",
        neurodivergent: "Neurodivergent",
        speech: "Sprachbehinderung",
        other: "Sonstiges",
        preferNotToSay: "Keine Angabe",
    },
    fr: {
        none: "Aucun handicap",
        visual: "Déficience visuelle",
        hearing: "Déficience auditive",
        mobility: "Handicap moteur",
        chronic: "Maladie chronique",
        cognitive: "Trouble cognitif",
        mentalHealth: "Santé mentale",
        neurodivergent: "Neurodivergent",
        speech: "Trouble de la parole",
        other: "Autre",
        preferNotToSay: "Ne souhaite pas répondre",
    },
    es: {
        none: "Sin discapacidad",
        visual: "Discapacidad visual",
        hearing: "Discapacidad auditiva",
        mobility: "Discapacidad motora",
        chronic: "Enfermedad crónica",
        cognitive: "Discapacidad cognitiva",
        mentalHealth: "Salud mental",
        neurodivergent: "Neurodivergente",
        speech: "Trastorno del habla",
        other: "Otro",
        preferNotToSay: "Prefiero no responder",
    },
};

const ALIAS: Record<string, DisabilityKey> = {
    "no disability": "none",
    "none": "none",
    "n/a": "preferNotToSay",
    "prefer not to say": "preferNotToSay",
    "visual": "visual",
    "blind": "visual",
    "hearing": "hearing",
    "deaf": "hearing",
    "mobility": "mobility",
    "physical": "mobility",
    "wheelchair": "mobility",
    "chronic": "chronic",
    "cognitive": "cognitive",
    "learning": "cognitive",
    "mental health": "mentalHealth",
    "mental": "mentalHealth",
    "neurodivergent": "neurodivergent",
    "autism": "neurodivergent",
    "adhd": "neurodivergent",
    "speech": "speech",
};

export type ParsedDisability =
    | { kind: "key"; key: DisabilityKey }
    | { kind: "other"; text: string }
    | { kind: "raw"; text: string };

export function parseDisability(value: string): ParsedDisability | null {
    if (!value) return null;
    if (value.startsWith("other:")) {
        return { kind: "other", text: value.slice("other:".length).trim() };
    }
    if ((DISABILITY_KEYS as readonly string[]).includes(value)) {
        return { kind: "key", key: value as DisabilityKey };
    }
    const alias = ALIAS[value.trim().toLowerCase()];
    if (alias) return { kind: "key", key: alias };
    return { kind: "raw", text: value };
}

export function serializeDisability(parsed: ParsedDisability | null): string {
    if (!parsed) return "";
    if (parsed.kind === "key") return parsed.key;
    if (parsed.kind === "other") return `other:${parsed.text}`;
    return parsed.text;
}

export function isDisabilityKey(value: string): value is DisabilityKey {
    return (DISABILITY_KEYS as readonly string[]).includes(value);
}

export function getDisabilityLabel(key: string, language: string = "en"): string {
    if (!isDisabilityKey(key)) return key;
    return TRANSLATIONS[language]?.[key] ?? TRANSLATIONS.en[key] ?? key;
}

export function isHiddenDisability(value: string): boolean {
    return value === "preferNotToSay";
}

export function renderDisability(value: string, language: string = "en"): string | null {
    const parsed = parseDisability(value);
    if (!parsed) return null;
    if (parsed.kind === "key") {
        if (parsed.key === "preferNotToSay") return null;
        return getDisabilityLabel(parsed.key, language);
    }
    if (parsed.kind === "other") return parsed.text || null;
    return parsed.text || null;
}
