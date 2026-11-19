import type { Resume } from "@/lib/schema";
import { DESIGN_KEYS, letterDesignSchema, type DesignKey, type DesignOverrides, type LetterDesign } from "./schema";

/**
 * The part of the CV's design a letter follows: fonts, colours, header look and
 * page margins. Picking only these keeps the frozen copy small and makes the
 * "what follows the CV" rule explicit. Paper size is not here: a letter owns it.
 */
export function pickLetterDesign(settings: Resume["settings"]): LetterDesign {
    return letterDesignSchema.parse({
        fontFamily: settings.typography.fontFamily,
        fontSize: settings.typography.fontSize,
        lineHeight: settings.typography.lineHeight,
        textColor: settings.colors.text,
        accentColor: settings.colors.accent,
        headerFontFamily: settings.header.fontFamily,
        headerFontWeight: settings.header.fontWeight,
        headerFontStyle: settings.header.fontStyle,
        headerTextTransform: settings.header.textTransform,
        marginHmm: settings.spacing.marginH,
        marginVmm: settings.spacing.marginV,
    });
}

/** What a letter with no CV looks like until the person changes something. */
export const DEFAULT_LETTER_DESIGN: LetterDesign = letterDesignSchema.parse({});

/** The base design with the letter's own changes on top. */
export function applyDesignOverrides(base: LetterDesign, overrides: DesignOverrides = {}): LetterDesign {
    const merged: Record<string, unknown> = { ...base };
    for (const key of DESIGN_KEYS) {
        if (overrides[key] !== undefined) merged[key] = overrides[key];
    }
    return letterDesignSchema.parse(merged);
}

/** The design values this letter sets itself, as opposed to taking from its CV or the default. */
export function overriddenDesignKeys(overrides: DesignOverrides = {}): DesignKey[] {
    return DESIGN_KEYS.filter((key) => overrides[key] !== undefined);
}
