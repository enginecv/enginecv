import type { Resume } from "@/lib/schema";
import { letterDesignSchema, type LetterDesign } from "./schema";

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
