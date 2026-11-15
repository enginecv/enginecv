/**
 * Single rule for which side of a two-column or mixed layout a section is on.
 * The preview draws with it and the Customize section list displays it, so the
 * toggle can never disagree with the page.
 *
 * - Two-column: an explicit left or right is honoured at any position; anything
 *   else (absent, a stale "full" from mixed mode) alternates by position.
 * - Mixed: left, right and full are honoured; absent alternates, with the first
 *   section full width.
 * - Position counts rendered content sections only (the caller passes them);
 *   separators and page breaks are never counted.
 */

export type SectionPlacement = "left" | "right" | "full";
export type PlacementMode = "two" | "mix";

export function getDefaultPlacement(index: number, mode: PlacementMode): SectionPlacement {
    if (mode === "mix" && index === 0) return "full";
    return index % 2 === 0 ? "left" : "right";
}

export function resolvePlacement(stored: string | undefined, index: number, mode: PlacementMode): SectionPlacement {
    if (mode === "two") {
        return stored === "left" || stored === "right" ? stored : getDefaultPlacement(index, "two");
    }
    if (stored === "left" || stored === "right" || stored === "full") return stored;
    return getDefaultPlacement(index, "mix");
}

/**
 * Sides for a list of content section keys in flow order. `keys` must hold only
 * the sections that are rendered, with no separators or page breaks. The stored
 * side is looked up by key, then by base id (repeated custom sections).
 */
export function resolveSectionPlacements(
    keys: string[],
    stored: Record<string, string> | undefined,
    mode: PlacementMode,
    baseOf: (key: string) => string,
): Record<string, SectionPlacement> {
    const result: Record<string, SectionPlacement> = {};
    keys.forEach((key, index) => {
        result[key] = resolvePlacement(stored?.[key] || stored?.[baseOf(key)], index, mode);
    });
    return result;
}
