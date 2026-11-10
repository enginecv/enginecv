import type { Resume } from "@/lib/schema";
import { entriesOf, entryTitle, isEmptyEntry, isThinEntry, matchKey, sameItem } from "./keys";
import {
    BASICS_FIELDS,
    CURRENT,
    NONE,
    STAGE_SECTIONS,
    type BasicsChoice,
    type FieldConflict,
    type FieldOption,
    type MergePlan,
    type MergeRow,
    type Origin,
    type StageSection,
    type StagedBatch,
    type StagedEntry,
} from "./types";

/** Fields that never count as a difference: identity, visibility and look. */
const IGNORED_FIELDS = new Set(["id", "hidden", "icon", "urlIcon", "issuerUrlIcon", "display"]);

/** A field value as comparable text. Lists join with new lines; other shapes become JSON. */
export function valueText(value: unknown): string {
    if (value === undefined || value === null) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "number") return String(value);
    if (Array.isArray(value)) return value.map((item) => valueText(item)).filter(Boolean).join("\n");
    if (typeof value === "boolean") return "";
    return JSON.stringify(value);
}

function fieldsOf(entries: StagedEntry[]): string[] {
    const names = new Set<string>();
    for (const entry of entries) {
        for (const key of Object.keys(entry)) {
            if (!IGNORED_FIELDS.has(key)) names.add(key);
        }
    }
    return [...names];
}

/** Longest text wins: a fuller wording or a more precise date. */
function fullest(options: FieldOption[]): FieldOption {
    return options.reduce((best, option) => (option.value.length > best.value.length ? option : best), options[0]);
}

function conflictsFor(existing: StagedEntry | undefined, origins: Origin[]): FieldConflict[] {
    const conflicts: FieldConflict[] = [];
    const entries = [...(existing ? [existing] : []), ...origins.map((origin) => origin.entry)];

    for (const field of fieldsOf(entries)) {
        const options: FieldOption[] = [];
        if (existing) options.push({ id: CURRENT, value: valueText(existing[field]) });
        for (const origin of origins) options.push({ id: origin.batchId, value: valueText(origin.entry[field]) });

        const filled = options.filter((option) => option.value !== "");
        if (filled.length === 0) continue;
        const distinct = new Set(filled.map((option) => option.value.toLowerCase()));
        const existingEmpty = existing !== undefined && options[0].value === "";
        // Different values need a choice. So does a gap in the CV that a source can fill.
        if (distinct.size < 2 && !existingEmpty) continue;

        const current = options.find((option) => option.id === CURRENT);
        const defaultId = current && current.value !== "" ? CURRENT : fullest(filled).id;
        conflicts.push({ field, options, defaultId });
    }
    return conflicts;
}

function buildRows(current: Resume, batches: StagedBatch[], section: StageSection): MergeRow[] {
    const existingEntries = entriesOf(current, section);
    const rows: MergeRow[] = [];
    const usedIds = new Map<string, number>();

    for (const batch of batches) {
        for (const entry of entriesOf(batch.resume, section)) {
            if (isEmptyEntry(section, entry)) continue;

            const row = rows.find((candidate) => candidate.origins.some((origin) => sameItem(section, origin.entry, entry)));
            if (row) {
                // The same source listing an item twice still brings it once.
                if (!row.origins.some((origin) => origin.batchId === batch.id)) {
                    row.origins.push({ batchId: batch.id, label: batch.label, entry });
                }
                continue;
            }

            const key = matchKey(section, entry) || "item";
            const count = (usedIds.get(key) ?? 0) + 1;
            usedIds.set(key, count);
            const existing = existingEntries.find((candidate) => sameItem(section, candidate, entry));
            rows.push({
                id: `${section}:${key}:${count}`,
                section,
                title: entryTitle(section, entry),
                origins: [{ batchId: batch.id, label: batch.label, entry }],
                existing,
                conflicts: [],
                thin: false,
                defaultSelected: false,
            });
        }
    }

    for (const row of rows) {
        row.conflicts = conflictsFor(row.existing, row.origins);
        row.thin = row.origins.every((origin) => isThinEntry(section, origin.entry));
        row.defaultSelected = !row.existing && !row.thin;
    }
    return rows;
}

function buildBasics(current: Resume, batches: StagedBatch[]): BasicsChoice[] {
    const choices: BasicsChoice[] = [];
    for (const field of BASICS_FIELDS) {
        const mine = valueText(current.basics[field]);
        const options: FieldOption[] = [];
        if (mine) options.push({ id: CURRENT, value: mine });
        for (const batch of batches) {
            const value = valueText(batch.resume.basics[field]);
            if (value && !options.some((option) => option.value === value)) options.push({ id: batch.id, value });
        }
        // Nothing to choose when no source adds a value that differs from the CV.
        if (options.length < 2 && (options.length === 0 || options[0].id === CURRENT)) continue;
        // Leaving a detail empty is always a choice.
        const defaultId = mine ? CURRENT : options[0].id;
        options.push({ id: NONE, value: "" });
        choices.push({ field, options, defaultId });
    }
    return choices;
}

/**
 * Groups what the sources brought by section, collapses the same item found in
 * several places into one row, marks rows already in the CV, and lists the
 * fields where the places disagree. Pure; the current CV is not changed.
 */
export function buildMergePlan(current: Resume, batches: StagedBatch[]): MergePlan {
    return {
        batches,
        basics: buildBasics(current, batches),
        rows: STAGE_SECTIONS.flatMap((section) => buildRows(current, batches, section)),
    };
}

/** How many entries a staged source holds across the sections the hub combines. */
export function countBatchEntries(batch: StagedBatch): number {
    return STAGE_SECTIONS.reduce((sum, section) => sum + entriesOf(batch.resume, section).filter((entry) => !isEmptyEntry(section, entry)).length, 0);
}
