import type { LetterDocument, LetterLayout, LetterPaperSize } from "./schema";

export interface LayoutChange {
    letter: LetterDocument;
    /** True when choosing the German layout moved the letter from Letter to A4: the person is told. */
    switchedToA4: boolean;
}

/**
 * Changes a letter's layout. The German layout is defined for A4: choosing it on another paper
 * size switches the letter to A4 and remembers the size; choosing the standard layout again
 * restores it. The CV is never touched (a CV does not store a paper size).
 */
export function applyLayout(letter: LetterDocument, layout: LetterLayout): LayoutChange {
    if (layout === letter.layout) return { letter, switchedToA4: false };
    if (layout === "din5008") {
        const switchedToA4 = letter.paperSize !== "a4";
        return {
            letter: { ...letter, layout, paperSize: "a4", paperSizeBeforeGerman: switchedToA4 ? letter.paperSize : (letter.paperSizeBeforeGerman ?? "a4") },
            switchedToA4,
        };
    }
    return { letter: { ...letter, layout, paperSize: letter.paperSizeBeforeGerman ?? letter.paperSize, paperSizeBeforeGerman: null }, switchedToA4: false };
}

/** A paper size choice. The German layout keeps A4: the choice is remembered for when it is left. */
export function applyPaperSize(letter: LetterDocument, paperSize: LetterPaperSize): LetterDocument {
    if (letter.layout === "din5008") return { ...letter, paperSizeBeforeGerman: paperSize };
    return { ...letter, paperSize };
}
