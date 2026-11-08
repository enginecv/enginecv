/**
 * README output labels the CV-language label sets don't carry. Like every
 * other document label they follow the resume's CV language, never the
 * interface language, and fall back to English.
 */

export interface ReadmeLabels {
    links: string;
    fullCv: string;
    builtWith: string;
}

const README_LABELS: Record<string, ReadmeLabels> = {
    en: { links: "Links", fullCv: "Full CV (PDF)", builtWith: "Built with EngineCV" },
    de: { links: "Links", fullCv: "Vollständiger Lebenslauf (PDF)", builtWith: "Erstellt mit EngineCV" },
    bs: { links: "Linkovi", fullCv: "Kompletan CV (PDF)", builtWith: "Napravljeno uz EngineCV" },
    fr: { links: "Liens", fullCv: "CV complet (PDF)", builtWith: "Créé avec EngineCV" },
    es: { links: "Enlaces", fullCv: "CV completo (PDF)", builtWith: "Creado con EngineCV" },
};

export function getReadmeLabels(language: string): ReadmeLabels {
    const base = language.toLowerCase().split(/[-_]/)[0];
    return README_LABELS[base] ?? README_LABELS.en;
}
