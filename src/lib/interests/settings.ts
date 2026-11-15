import { DEFAULT_INTERESTS_SECTION, type InterestsSection } from "@/lib/schema";

/**
 * True when every field equals the default. Templates are applied as setting
 * presets, so a template that leaves Interests at the default must not reset
 * the style the user chose; only a template that deliberately changes it (ATS
 * Plain turns icons off) is applied.
 */
export function isDefaultInterestsSection(section: InterestsSection): boolean {
    return (Object.keys(DEFAULT_INTERESTS_SECTION) as (keyof InterestsSection)[])
        .every((key) => section[key] === DEFAULT_INTERESTS_SECTION[key]);
}

/** Which interests section settings a template application should produce. */
export function resolveInterestsSectionForTemplate(
    current: InterestsSection,
    fromTemplate: InterestsSection,
): InterestsSection {
    return isDefaultInterestsSection(fromTemplate) ? current : fromTemplate;
}
