import { serializeAuthoring } from "./from-resume";
import {
    AUTHORING_FORMAT,
    AUTHORING_SCHEMA_URL,
    BASICS_FIELDS,
    LIST_SECTION_KEYS,
    SECTION_ENTRY_SPECS,
    type AuthoringDocument,
    type EntrySpec,
} from "./schema";

/**
 * "Copy instructions for your AI" (research R9): localized prose around a
 * language-neutral field overview and example. The overview is generated
 * from the same field tables as the schema, so the two cannot drift.
 */

export type Translate = (key: string, params?: Record<string, string | number>) => string;

const RULE_KEYS = ["oneBlock", "format", "noInvent", "wording", "dates", "language"] as const;

/** The example from contracts/authoring-v1.md; it imports without a single notice. */
export const AUTHORING_EXAMPLE: AuthoringDocument = {
    format: AUTHORING_FORMAT,
    design: { template: "enginecv-modern", accent: "#1f3a5f", cvLanguage: "de" },
    basics: {
        name: "Amina Hodžić",
        headline: "Pflegefachkraft",
        email: "amina@example.com",
        phone: "+387 61 000 000",
        location: "Sarajevo, Bosnia and Herzegovina",
        linkedin: "https://www.linkedin.com/in/amina",
    },
    summary: "Registered nurse with **6 years** in intensive care.",
    experience: [{
        position: "Medicinska sestra, ICU",
        company: "KCUS",
        location: "Sarajevo",
        start: "2019-03",
        end: "present",
        highlights: ["Ventilated patients, 1:2 ratio", "Trained 8 new nurses"],
    }],
    education: [{ institution: "Univerzitet u Sarajevu", studyType: "Bachelor", area: "Nursing", end: "2018" }],
    skills: { Clinical: ["Intensive care", { name: "Wound care", level: "expert" }], Tools: ["SAP IS-H"] },
    languages: ["Bosnian: native", "German: B2", "English: B1"],
};

/** Field names an AI writes; ids and `hidden` are for round trips, not new CVs. */
function fieldNames(spec: EntrySpec): string {
    return Object.keys(spec.fields).filter((name) => name !== "id" && name !== "hidden").join(", ");
}

export function buildFieldOverview(): string {
    const lines = [
        `- format: "${AUTHORING_FORMAT}" (required)`,
        "- design (optional hints): template, accent (\"#rrggbb\"), cvLanguage",
        `- basics: ${Object.keys(BASICS_FIELDS).join(", ")}`,
        "- summary: Markdown text",
        ...LIST_SECTION_KEYS.map((key) => `- ${key}[]: ${fieldNames(SECTION_ENTRY_SPECS[key])}`),
        `- declaration: ${fieldNames(SECTION_ENTRY_SPECS.declaration)}`,
        "- skills: [\"name\", ...] or { \"Group\": [\"name\", { \"name\", \"level\" }] }; level: beginner, amateur, competent, proficient, expert",
        "- languages: [\"Language: level\", ...]; level: A1–C2 or native",
        `- interests: ["name", ...] or [{ ${fieldNames(SECTION_ENTRY_SPECS.interests)} }]`,
        `- custom[]: { title, text } or { title, tags: [...] } or { title, entries: [{ ${fieldNames(SECTION_ENTRY_SPECS.customEntry)} }] }`,
    ];
    return lines.join("\n");
}

export function buildAiInstructions(t: Translate): string {
    return [
        t("authoring.instructions.intro"),
        "",
        t("authoring.instructions.rulesTitle"),
        ...RULE_KEYS.map((key, index) => `${index + 1}. ${t(`authoring.instructions.rule.${key}`)}`),
        "",
        t("authoring.instructions.fieldsTitle"),
        buildFieldOverview(),
        "",
        t("authoring.instructions.exampleTitle"),
        "```json",
        serializeAuthoring(AUTHORING_EXAMPLE, "pretty"),
        "```",
        "",
        t("authoring.instructions.schema", { url: AUTHORING_SCHEMA_URL }),
        "",
        t("authoring.instructions.notesTitle"),
        "",
    ].join("\n");
}
