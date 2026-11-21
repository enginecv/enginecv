import { serializeAuthoring } from "./from-resume";
import { AUTHORING_EXAMPLE, buildFieldOverview } from "./instructions";
import {
    AUTHORING_FORMAT,
    AUTHORING_SCHEMA_URL,
    BASICS_FIELDS,
    LIST_SECTION_KEYS,
    SECTION_ENTRY_SPECS,
    type EntrySpec,
} from "./schema";
import { FOLDER_AGENTS_URL, FOLDER_REFERENCE_URL, SKILL_URL } from "./skill-urls";

/**
 * The EngineCV agent skill: guidance a local AI agent reads before it edits a
 * CV file in the workspace folder. Generated from the same field tables as the format and its
 * JSON Schema, so the two cannot drift; `scripts/generate-agent-skill.ts`
 * writes the public files and a unit test fails when they are stale.
 */


const SKILL_DESCRIPTION =
    "Edit the user's EngineCV resume file (an enginecv.authoring/v1 JSON document) safely. Use when the user asks you to add, change, remove or reorder content in their CV or resume file.";

function fieldTable(spec: EntrySpec): string {
    const rows = Object.entries(spec.fields)
        .filter(([name]) => name !== "hidden")
        .map(([name, field]) => `| \`${name}\` | ${field.kind} | ${field.describe.replace(/\|/g, "\\|")} |`);
    return ["| Field | Kind | Meaning |", "| --- | --- | --- |", ...rows].join("\n");
}

function sectionTables(): string {
    const parts: string[] = [];
    for (const key of LIST_SECTION_KEYS) {
        parts.push(`### \`${key}\` (list of entries)`, "", fieldTable(SECTION_ENTRY_SPECS[key]), "");
    }
    parts.push("### `declaration`", "", fieldTable(SECTION_ENTRY_SPECS.declaration), "");
    parts.push("### `interests` (entries)", "", fieldTable(SECTION_ENTRY_SPECS.interests), "");
    parts.push("### `custom[].entries[]`", "", fieldTable(SECTION_ENTRY_SPECS.customEntry), "");
    return parts.join("\n");
}

function basicsTable(): string {
    const rows = Object.entries(BASICS_FIELDS).map(
        ([name, field]) => `| \`${name}\` | ${field.describe.replace(/\|/g, "\\|")} |`,
    );
    return ["| Field | Meaning |", "| --- | --- |", ...rows].join("\n");
}

const PRIVACY_WARNING =
    "The file holds the user's CV, including contact details. Treat it as private: never copy it to a place the user did not ask for, and tell the user that reading it may send its contents to your model provider.";

const RULES = [
    "Edit only what the user asked for. Leave every other entry, field and section byte-for-byte as it is.",
    "Keep the user's wording, dates and language. Never invent facts, employers, dates, numbers or skills.",
    "Keep entry `id` values when you edit an entry. Leave `id` out for a new entry; the app assigns one.",
    "Keep the file valid JSON (double quotes, no comments, no trailing commas).",
    "Do not edit `design` or anything about looks. Design belongs to the app.",
    "Make small targeted edits with your patch or string-replace tool, changing only the part you were asked about. Do not re-output or rewrite the whole file: a CV file can be tens of kilobytes, and rewriting it wastes tokens and risks changing things you did not mean to. To find a part, search for its key (for example `\"projects\"`) or an entry `id` instead of reading the whole file.",
    "Keep the file's formatting (2-space indent, key order) so a change stays a small diff.",
    "Every edit must leave the file valid JSON; put related changes (such as adding an entry and its comma) in one edit. If the file is briefly invalid between two edits, the app keeps the CV as it was and picks the result up once the file is valid again.",
    "Do not rename or move the file. Its name is the name of the CV in the app.",
    "If a request is unclear or would need information you do not have, ask the user first.",
];

const HOW_TO = [
    "**Add an entry**: append an object to the section's array, using the fields in the table for that section. Leave out `id`.",
    "**Edit an entry**: find it by its `id` (or by matching text), change only the fields asked for, keep its `id`.",
    "**Remove an entry**: delete its object from the array. An empty section may stay as `[]` or be removed.",
    "**Add a section**: add the section key with its content. The order of keys in the file is the order of sections in the CV.",
    "**Reorder sections**: reorder the keys at the top level of the document.",
    "**Add a custom section**: add an object to `custom` with a `title` and either `text`, `tags` or `entries`.",
    "**Hide an entry from the printed CV**: set `\"hidden\": true` on it.",
];

const OUT_OF_SCOPE = [
    "Design, colours, fonts, templates and layout.",
    "The photo and the signature (they are never stored in the file).",
    "Exporting to PDF, Word or other formats.",
];

function buildSkillBody(): string {
    return [
        "# EngineCV resume file",
        "",
        "EngineCV (https://enginecv.app) is a resume builder that runs in the browser. The user keeps their CVs as JSON files in a workspace folder on their computer. You edit those files with your normal file tools; EngineCV notices the change within a few seconds, checks it and updates the CV. If you do not know the folder or the file's path, ask the user for it.",
        "",
        `> ${PRIVACY_WARNING}`,
        "",
        "Sign your work: add a top-level `\"edited_by\": \"<your name>\"` (for example `Claude Code`). EngineCV shows it in a notification so the person sees what changed and who did it.",
        "",
        "## The format",
        "",
        `The file is one JSON document with \`"format": "${AUTHORING_FORMAT}"\`. Schema: ${AUTHORING_SCHEMA_URL}`,
        "",
        "Overview:",
        "",
        buildFieldOverview(),
        "",
        "### `basics`",
        "",
        basicsTable(),
        "",
        sectionTables(),
        "### Worked example",
        "",
        "```json",
        serializeAuthoring(AUTHORING_EXAMPLE, "pretty"),
        "```",
        "",
        "## How to",
        "",
        ...HOW_TO.map((line) => `- ${line}`),
        "",
        "## Rules",
        "",
        ...RULES.map((rule, index) => `${index + 1}. ${rule}`),
        "",
        "## Out of scope",
        "",
        "Tell the user to do these in the app instead:",
        "",
        ...OUT_OF_SCOPE.map((line) => `- ${line}`),
        "",
        "## Verify",
        "",
        "Check the part you changed (search for it; no need to read the whole file). The app shows \"Updated from file\" when it accepted the change. When something is wrong it keeps the previous CV and shows an error with a line and column; fix the file and write it again. The user can always restore the earlier version from the editor's history.",
        "",
    ].join("\n");
}

export function buildSkillMarkdown(): string {
    return [
        "---",
        "name: enginecv",
        `description: ${SKILL_DESCRIPTION}`,
        "---",
        "",
        buildSkillBody(),
    ].join("\n");
}

export function buildAgentsSnippet(): string {
    return [
        "## EngineCV resume file",
        "",
        `The user's CV lives in a JSON file in the \`${AUTHORING_FORMAT}\` format, in a workspace folder connected to https://enginecv.app. Ask for the file's path if you do not know it. Full guidance: ${SKILL_URL}`,
        "",
        `${PRIVACY_WARNING}`,
        "",
        "Rules:",
        "",
        ...RULES.map((rule, index) => `${index + 1}. ${rule}`),
        "",
        `Format overview (schema: ${AUTHORING_SCHEMA_URL}):`,
        "",
        buildFieldOverview(),
        "",
        "Out of scope (tell the user to use the app): " + OUT_OF_SCOPE.join(" ").replace(/\.\s/g, "; ").replace(/\.$/, "."),
        "",
        "After editing, check the part you changed. The app shows \"Updated from file\" or an error with a line and column.",
        "",
    ].join("\n");
}

export function buildLlmsTxt(): string {
    return [
        "# EngineCV agent skill",
        "",
        "> How an AI agent edits a resume file for EngineCV (https://enginecv.app).",
        "",
        `- [SKILL.md](${SKILL_URL}): the full skill: format, how to, rules.`,
        `- [AGENTS snippet](https://enginecv.app/agent/enginecv/AGENTS-snippet.md): the short version for AGENTS.md, CLAUDE.md or rules files.`,
        `- [JSON Schema](${AUTHORING_SCHEMA_URL}): the machine-readable schema of the \`${AUTHORING_FORMAT}\` format.`,
        "",
        "## Workspace folder (preferred)",
        "",
        "If the user has an EngineCV workspace folder (it contains `.enginecv/index.json` and `AGENTS.md`), work there instead: read `AGENTS.md`, then `.enginecv/index.json`, then only the file you need. The folder holds CVs, letters and exports, and EngineCV answers export requests. The same guidance, for reading before you have the folder:",
        "",
        `- [AGENTS.md](${FOLDER_AGENTS_URL}): the short rules.`,
        `- Reference files in ${FOLDER_REFERENCE_URL}/: \`cv-format.md\`, \`letter-format.md\`, \`exports.md\`, \`recipes.md\`.`,
        "",
    ].join("\n");
}
