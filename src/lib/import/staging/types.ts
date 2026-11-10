import type { Resume } from "@/lib/schema";
import type { ConversionReport } from "@/lib/json-resume/report";

/** Sections the hub can combine. Skills are read across all groups. */
export const STAGE_SECTIONS = [
    "experience",
    "education",
    "projects",
    "skills",
    "organisations",
    "certificates",
    "awards",
    "publications",
    "languages",
    "courses",
    "references",
    "interests",
] as const;

export type StageSection = (typeof STAGE_SECTIONS)[number];

/** One entry of any section. Every entry has an id; the rest depends on the section. */
export type StagedEntry = { id: string } & Record<string, unknown>;

/** What one source brought, held in memory until the person applies it. */
export interface StagedBatch {
    id: string;
    sourceId: string;
    label: string;
    resume: Resume;
    /** Came from a "Download my data" file, which cannot replace a single CV. */
    fromDataExport?: boolean;
    /** What the source could not carry, when it can say. */
    losses?: ConversionReport;
}

/** An id for "the value already in the CV" in a choice list. */
export const CURRENT = "current";

export interface Origin {
    batchId: string;
    label: string;
    entry: StagedEntry;
}

export interface FieldOption {
    /** `CURRENT` or a batch id. */
    id: string;
    value: string;
}

export interface FieldConflict {
    field: string;
    options: FieldOption[];
    defaultId: string;
}

export interface MergeRow {
    id: string;
    section: StageSection;
    /** Short text to show for the row. */
    title: string;
    origins: Origin[];
    /** The entry already in the CV that this row matches. */
    existing?: StagedEntry;
    conflicts: FieldConflict[];
    /** Nothing but a name: ticked off by default. */
    thin: boolean;
    /** Ticked by default when merging: new and not thin. */
    defaultSelected: boolean;
}

export const BASICS_FIELDS = [
    "name",
    "headline",
    "email",
    "phone",
    "location",
    "website",
    "linkedin",
    "github",
    "summary",
    "photo",
] as const;

export type BasicsField = (typeof BASICS_FIELDS)[number];

export interface BasicsChoice {
    field: BasicsField;
    options: FieldOption[];
    defaultId: string;
}

export interface MergePlan {
    batches: StagedBatch[];
    basics: BasicsChoice[];
    rows: MergeRow[];
}

/** What the person ticked and which value they picked. Anything missing falls back to the plan's default. */
export interface Selection {
    rows: Record<string, boolean>;
    /** row id, then field, to the chosen option id. */
    fields: Record<string, Record<string, string>>;
    basics: Partial<Record<BasicsField, string>>;
}

export type ApplyMode = "merge" | "replace" | "new";
