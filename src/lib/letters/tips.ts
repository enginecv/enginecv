import { blogPostPath } from "@/lib/site";

/** Blog articles the letter editor links to from its sections. Each id has a `letters.tips.<id>` label. */
export const LETTER_TIPS = {
    howToWrite: "how-to-write-a-cover-letter",
    oneCvManyLetters: "one-cv-many-cover-letters",
    inEnginecv: "cover-letters-in-enginecv",
    german: "german-cover-letter-din-5008",
    germanPackage: "german-job-application-lebenslauf-anschreiben",
} as const;

export type LetterTipId = keyof typeof LETTER_TIPS;

/** The editor sections that offer tips. The status section explains itself and has none. */
export type LetterTipSection = "recipient" | "text" | "sender" | "page";

export const SECTION_TIPS: Record<LetterTipSection, readonly LetterTipId[]> = {
    recipient: ["howToWrite", "german"],
    text: ["howToWrite", "inEnginecv"],
    sender: ["inEnginecv", "oneCvManyLetters"],
    page: ["german", "germanPackage"],
};

/** The articles are written in English, so the link always goes to the English page. */
export function letterTipHref(id: LetterTipId): string {
    return blogPostPath(LETTER_TIPS[id]);
}
