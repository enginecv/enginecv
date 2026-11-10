/**
 * What a conversion dropped or changed. Domain only: it never produces UI text.
 * The UI renders `conversion.loss.<code>` from the translation files, so every
 * code in LOSS_CODES needs a translation in all five locales (a test enforces it).
 *
 * left-out = data the target format has no place for, so it is not in the result;
 * changed  = data that is in the result but in a different or reduced form.
 */

export type LossKind = "left-out" | "changed";

export const LOSS_CODES = [
    // Import (JSON Resume to EngineCV)
    "photo-url-not-fetched",
    "date-day-dropped",
    "company-description-left-out",
    "project-roles-left-out",
    "project-type-left-out",
    "volunteer-highlights-folded",
    "interest-keywords-folded",
    "skill-level-kept-as-text",
    "skill-level-adjusted",
    "theme-left-out",
    "unknown-keys-ignored",
    "empty-entries-skipped",
    "invalid-values-skipped",
    // Export (EngineCV to JSON Resume)
    "hidden-entries-left-out",
    "custom-sections-left-out",
    "declaration-left-out",
    "personal-details-left-out",
    "photo-left-out",
    "cover-letters-left-out",
    "courses-section-left-out",
    "entry-extras-left-out",
    "skill-groups-flattened",
    "language-details-left-out",
    "dates-unparsed-left-out",
    "location-parts-simplified",
] as const;

export type LossCode = (typeof LOSS_CODES)[number];

export interface LossItem {
    kind: LossKind;
    code: LossCode;
    /** EngineCV section key (`experience`, `basics`, ...), or "" when not tied to one. */
    section: string;
    /** How many entries or values are affected, when it is a count. */
    count?: number;
}

export interface ConversionReport {
    items: LossItem[];
}

export function emptyReport(): ConversionReport {
    return { items: [] };
}

/** Adds an item, summing counts for the same code and section. */
export function addLoss(report: ConversionReport, kind: LossKind, code: LossCode, section = "", count?: number): void {
    const existing = report.items.find((item) => item.code === code && item.section === section);
    if (existing) {
        if (count !== undefined) existing.count = (existing.count ?? 0) + count;
        return;
    }
    report.items.push({ kind, code, section, ...(count !== undefined ? { count } : {}) });
}

export function mergeReports(...reports: ConversionReport[]): ConversionReport {
    const merged = emptyReport();
    for (const report of reports) {
        for (const item of report.items) addLoss(merged, item.kind, item.code, item.section, item.count);
    }
    return merged;
}

export function hasLosses(report: ConversionReport): boolean {
    return report.items.length > 0;
}

export function itemsOfKind(report: ConversionReport, kind: LossKind): LossItem[] {
    return report.items.filter((item) => item.kind === kind);
}
