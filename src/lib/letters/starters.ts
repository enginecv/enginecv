import { createId } from "@/lib/id";
import type { LetterDocument, LetterParagraph } from "./schema";

/**
 * Per-language defaults for a new letter: salutation, closing, subject wording
 * and the subject wording. The letter's language is its own, so
 * these follow it and not the interface language. Unknown languages use English.
 */
export interface LetterStarter {
    salutation: string;
    closing: string;
    /** "Application for" style prefix; the role is appended. */
    subjectPrefix: string;
}

const STARTERS: Record<string, LetterStarter> = {
    en: {
        salutation: "Dear Hiring Manager,",
        closing: "Kind regards,",
        subjectPrefix: "Application for",
    },
    de: {
        salutation: "Sehr geehrte Damen und Herren,",
        closing: "Mit freundlichen Grüßen",
        subjectPrefix: "Bewerbung als",
    },
    fr: {
        salutation: "Madame, Monsieur,",
        closing: "Cordialement,",
        subjectPrefix: "Candidature au poste de",
    },
    es: {
        salutation: "Estimados señores:",
        closing: "Atentamente,",
        subjectPrefix: "Candidatura para",
    },
    bs: {
        salutation: "Poštovani,",
        closing: "S poštovanjem,",
        subjectPrefix: "Prijava za",
    },
};

/** "de", "de-AT" and "DE" all give the German starter. */
export function baseLanguage(language: string): string {
    return language.toLowerCase().split(/[-_]/)[0] || "en";
}

export function getLetterStarters(language: string): LetterStarter {
    return STARTERS[baseLanguage(language)] ?? STARTERS.en;
}

/**
 * Salutation, closing, subject and one empty paragraph for a new letter. A letter has as many
 * paragraphs as it needs (DIN 5008 sets the layout, not a count), so it starts with one and the
 * person adds more; the usual structure is offered as optional tips, not as a fixed set.
 */
export function buildStarterContent(language: string, role = ""): Pick<LetterDocument, "salutation" | "closing" | "subject" | "paragraphs"> {
    const starter = getLetterStarters(language);
    const paragraphs: LetterParagraph[] = [{ id: createId(), markdown: "", prompt: "" }];
    return {
        salutation: starter.salutation,
        closing: starter.closing,
        subject: role.trim() ? `${starter.subjectPrefix} ${role.trim()}` : "",
        paragraphs,
    };
}

/** A long date in the letter's language ("18 November 2026", "18. November 2026"). */
export function formatLetterDate(iso: string, language: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!match) return iso;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" };
    try {
        return new Intl.DateTimeFormat(language, options).format(date);
    } catch {
        return new Intl.DateTimeFormat("en", options).format(date);
    }
}
