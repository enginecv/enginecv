const ENGLISH_WORD = "DELETE";

/** The typed confirmation for "delete all my data": the word in the user's language, or DELETE. */
export function isConfirmWord(input: string, localizedWord: string): boolean {
    const typed = input.trim().toLocaleUpperCase();
    return typed.length > 0 && (typed === localizedWord.trim().toLocaleUpperCase() || typed === ENGLISH_WORD);
}
