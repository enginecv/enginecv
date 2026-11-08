import {
    SECTION_STYLE_KEYS,
    type DeepPartial,
    type Resume,
    type ResumeSettings,
    type SectionStyleKey,
    type SectionStyleOverride,
} from "./schema";

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function mergeCustomizationValue<T>(base: T, patch: DeepPartial<T>): T {
    if (!isPlainObject(base) || !isPlainObject(patch)) {
        return patch as T;
    }

    const merged: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue;
        const current = merged[key];
        merged[key] = isPlainObject(current) && isPlainObject(value)
            ? mergeCustomizationValue(current, value)
            : value;
    }
    return merged as T;
}

export function resolveSectionSettings(
    settings: ResumeSettings,
    override: SectionStyleOverride | undefined,
): ResumeSettings {
    if (!override) return settings;

    const resolved = { ...settings };
    for (const key of SECTION_STYLE_KEYS) {
        const patch = override[key];
        if (!patch) continue;
        (resolved as Record<string, unknown>)[key] = mergeCustomizationValue(
            settings[key],
            patch,
        );
    }
    return resolved;
}

export function getSectionStyleOverride(
    resume: Pick<Resume, "customization">,
    sectionKey: string,
): SectionStyleOverride | undefined {
    return resume.customization.sectionOverrides[sectionKey];
}

export function hasSectionStyleOverride(
    resume: Pick<Resume, "customization">,
    sectionKey: string,
    styleKey?: SectionStyleKey,
): boolean {
    const override = getSectionStyleOverride(resume, sectionKey);
    if (!override) return false;
    if (!styleKey) return Object.keys(override).length > 0;
    const style = override[styleKey];
    return Boolean(style && Object.keys(style as object).length > 0);
}

export function withoutSectionStyleOverride(
    overrides: Record<string, SectionStyleOverride>,
    sectionKey: string,
    styleKey?: SectionStyleKey,
): Record<string, SectionStyleOverride> {
    const next = { ...overrides };
    if (!styleKey) {
        delete next[sectionKey];
        return next;
    }

    const current = next[sectionKey];
    if (!current) return next;
    const section = { ...current };
    delete section[styleKey];
    if (Object.keys(section).length === 0) delete next[sectionKey];
    else next[sectionKey] = section;
    return next;
}
