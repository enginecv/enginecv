import type { LetterDocument } from "@/lib/letters/schema";
import type { Resume } from "@/lib/schema";

/** What a document is called in lists and in file names. */
export const cvTitle = (cv: Resume) => cv.meta.title || cv.basics.name || "CV";
export const letterTitle = (letter: LetterDocument) => letter.title || [letter.company, letter.role].filter(Boolean).join(" - ") || "Letter";
