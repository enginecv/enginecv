import { createId } from "@/lib/id";
import {
    UNGROUPED_SKILL_GROUP_ID,
    createUngroupedSkillGroup,
    normalizeSkillGroups,
    type Resume,
} from "@/lib/schema";
import { createNewResume } from "@/lib/templates/default-design";
import { entriesOf } from "./keys";
import {
    CURRENT,
    STAGE_SECTIONS,
    type ApplyMode,
    type MergePlan,
    type MergeRow,
    type Selection,
    type StageSection,
    type StagedEntry,
} from "./types";

type Draft = Resume & Record<string, unknown>;

function isEmptyValue(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value === "string") return value.trim() === "";
    if (Array.isArray(value)) return value.length === 0;
    return false;
}

/** Is the row ticked? A new or replacement CV has nothing to match, so only a name-only row starts unticked. */
export function isRowSelected(row: MergeRow, selection: Selection, mode: ApplyMode = "merge"): boolean {
    return selection.rows[row.id] ?? (mode === "merge" ? row.defaultSelected : !row.thin);
}

/** The raw value a choice stands for: the CV's own, or the one a source brought. */
function rawValue(row: MergeRow, field: string, optionId: string): unknown {
    if (optionId === CURRENT) return row.existing?.[field];
    return row.origins.find((origin) => origin.batchId === optionId)?.entry[field];
}

function chosenId(row: MergeRow, field: string, selection: Selection, fallback: string): string {
    return selection.fields[row.id]?.[field] ?? fallback;
}

/** A fresh entry from the row's sources: the first one, gaps filled from the others, then the person's choices. */
function buildEntry(row: MergeRow, selection: Selection): StagedEntry {
    const [first, ...others] = row.origins;
    const entry: StagedEntry = { ...structuredClone(first.entry), id: createId(), hidden: false };

    for (const other of others) {
        for (const [field, value] of Object.entries(other.entry)) {
            if (field === "id" || field === "hidden") continue;
            if (isEmptyValue(entry[field]) && !isEmptyValue(value)) entry[field] = structuredClone(value);
        }
    }
    for (const conflict of row.conflicts) {
        const id = chosenId(row, conflict.field, selection, conflict.defaultId);
        // In a fresh entry the CV has no value to keep.
        const optionId = id === CURRENT ? (conflict.options.find((option) => option.id !== CURRENT)?.id ?? id) : id;
        const raw = rawValue(row, conflict.field, optionId);
        if (raw !== undefined) entry[conflict.field] = structuredClone(raw);
    }
    return entry;
}

function findEntry(draft: Draft, section: StageSection, id: string): StagedEntry | undefined {
    return entriesOf(draft, section).find((entry) => entry.id === id);
}

/** Writes the choices a person made into an entry that is already in the CV. */
function updateExisting(draft: Draft, row: MergeRow, selection: Selection) {
    if (!row.existing) return;
    const target = findEntry(draft, row.section, row.existing.id);
    if (!target) return;
    for (const conflict of row.conflicts) {
        const id = chosenId(row, conflict.field, selection, conflict.defaultId);
        if (id === CURRENT) continue;
        const raw = rawValue(row, conflict.field, id);
        if (raw !== undefined) target[conflict.field] = structuredClone(raw);
    }
}

function addEntry(draft: Draft, section: StageSection, entry: StagedEntry) {
    if (section === "skills") {
        const groups = normalizeSkillGroups(draft.skillGroups);
        const ungrouped = groups.find((group) => group.id === UNGROUPED_SKILL_GROUP_ID) ?? createUngroupedSkillGroup();
        ungrouped.skills.push(entry as never);
        draft.skillGroups = groups;
        return;
    }
    (draft[section] as StagedEntry[]).push(entry);
}

function clearSections(draft: Draft) {
    for (const section of STAGE_SECTIONS) {
        if (section === "skills") draft.skillGroups = [createUngroupedSkillGroup()];
        else (draft as Record<string, unknown>)[section] = [];
    }
    const stage = new Set<string>(STAGE_SECTIONS);
    draft.settings.contentSections = draft.settings.contentSections.filter((key) => !stage.has(key));
    draft.settings.layout.sectionOrder = draft.settings.layout.sectionOrder.filter((key) => !stage.has(key));
}

function applyBasics(draft: Draft, plan: MergePlan, selection: Selection, mode: ApplyMode) {
    for (const choice of plan.basics) {
        let id = selection.basics[choice.field] ?? choice.defaultId;
        // A new or replaced CV has no "current" value to keep.
        if (id === CURRENT && mode !== "merge") id = choice.options.find((option) => option.id !== CURRENT)?.id ?? id;
        if (id === CURRENT) continue;
        const option = choice.options.find((candidate) => candidate.id === id);
        if (!option) continue;
        draft.basics[choice.field] = option.value;
        if (choice.field === "location") {
            const batch = plan.batches.find((candidate) => candidate.id === id);
            draft.basics.locationParts = batch
                ? structuredClone(batch.resume.basics.locationParts)
                : { address: "", postalCode: "", city: "", region: "", countryCode: "" };
        }
    }
}

/** Makes sections that gained entries visible and listed. */
function revealSections(draft: Draft, gained: Set<StageSection>) {
    for (const section of STAGE_SECTIONS) {
        if (!gained.has(section)) continue;
        if (!draft.settings.contentSections.includes(section)) draft.settings.contentSections.push(section);
        if (!draft.settings.layout.sectionOrder.includes(section)) draft.settings.layout.sectionOrder.push(section);
        draft.settings.hiddenSections = draft.settings.hiddenSections.filter((key) => key !== section);
    }
}

/**
 * Applies what the person ticked and chose. Pure: returns a new CV and leaves
 * `current` as it was.
 * - `merge`: adds ticked rows, updates only fields where a source value was
 *   chosen, leaves everything else alone.
 * - `replace`: adopts the first source's CV with only the ticked rows in it,
 *   keeping this CV's id and creation time.
 * - `new`: a fresh CV holding only the ticked rows.
 */
export function applyMergePlan(current: Resume, plan: MergePlan, selection: Selection, mode: ApplyMode = "merge"): Resume {
    let draft: Draft;
    if (mode === "merge") {
        draft = structuredClone(current) as Draft;
    } else if (mode === "replace") {
        const source = plan.batches[0]?.resume ?? current;
        draft = { ...structuredClone(source), id: current.id, createdAt: current.createdAt } as Draft;
        clearSections(draft);
    } else {
        draft = createNewResume() as Draft;
    }

    const gained = new Set<StageSection>();
    for (const row of plan.rows) {
        if (!isRowSelected(row, selection, mode)) continue;
        if (mode === "merge" && row.existing) {
            updateExisting(draft, row, selection);
        } else {
            addEntry(draft, row.section, buildEntry(row, selection));
            gained.add(row.section);
        }
    }

    applyBasics(draft, plan, selection, mode);
    revealSections(draft, gained);
    return draft;
}

export interface SelectionSummary {
    /** Entries that will be added. */
    add: number;
    /** Fields of existing entries and of the person's details that will change. */
    update: number;
}

/** What applying would do, for the counts shown next to the Apply button. */
export function summarizeSelection(plan: MergePlan, selection: Selection, mode: ApplyMode = "merge"): SelectionSummary {
    let add = 0;
    let update = 0;
    for (const row of plan.rows) {
        if (!isRowSelected(row, selection, mode)) continue;
        if (mode === "merge" && row.existing) {
            update += row.conflicts.filter((conflict) => (selection.fields[row.id]?.[conflict.field] ?? conflict.defaultId) !== CURRENT).length;
        } else {
            add += 1;
        }
    }
    update += plan.basics.filter((choice) => {
        const id = selection.basics[choice.field] ?? choice.defaultId;
        return id !== CURRENT || mode !== "merge";
    }).length;
    return { add, update };
}
