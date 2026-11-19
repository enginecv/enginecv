import type { ResolvedLetter } from "./resolve";

/** "cover-letter-acme-product-designer": a safe file name stem from what the letter is for. */
export function letterFileBaseName(letter: Pick<ResolvedLetter, "company" | "role" | "sender">): string {
    const slug = [letter.company, letter.role]
        .map((part) => part.trim().toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
        .filter(Boolean)
        .join("-");
    return slug ? `cover-letter-${slug}`.slice(0, 80).replace(/-$/, "") : "cover-letter";
}
