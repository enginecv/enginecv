import { markdownToPlainText } from "@/lib/export-plaintext";
import type { ResolvedLetter } from "./resolve";

function lines(text: string): string[] {
    return text.split("\n").map((line) => line.trim()).filter(Boolean);
}

/**
 * The letter as plain text, in reading order: sender, date, recipient, subject,
 * salutation, paragraphs, closing, signature. No styling survives; list items become
 * dashes and a link shows its address after its text. Tokens are already resolved, so
 * no `{{token}}` can appear.
 */
export function toLetterPlainText(letter: ResolvedLetter): string {
    const { sender } = letter;
    const blocks: string[] = [];
    const add = (...parts: Array<string | false | null | undefined>) => {
        const text = parts.filter((part): part is string => Boolean(part && part.trim())).join("\n");
        if (text) blocks.push(text);
    };

    add(sender.name, sender.headline, [sender.email, sender.phone, sender.website].filter(Boolean).join("  ·  "), ...lines(sender.address));
    add(letter.date);
    add(letter.recipient.name, ...lines(letter.recipient.address));
    add(letter.subject);
    add(letter.salutation);
    for (const paragraph of letter.paragraphs) {
        if (paragraph.empty) continue;
        add(markdownToPlainText(paragraph.markdown));
    }
    add(letter.closing);
    add(sender.signatureName || sender.name);
    return `${blocks.join("\n\n")}\n`;
}

/** The letter as Markdown: the paragraphs keep their bold, italic, links and lists; the rest is plain lines. */
export function toLetterMarkdown(letter: ResolvedLetter): string {
    const { sender } = letter;
    const blocks: string[] = [];
    // Two trailing spaces end a line without starting a new paragraph.
    const add = (...parts: Array<string | false | null | undefined>) => {
        const text = parts.filter((part): part is string => Boolean(part && part.trim())).join("  \n");
        if (text) blocks.push(text);
    };

    add(sender.name && `**${sender.name}**`, sender.headline, [sender.email, sender.phone, sender.website].filter(Boolean).join(" · "), ...lines(sender.address));
    add(letter.date);
    add(letter.recipient.name, ...lines(letter.recipient.address));
    add(letter.subject && `**${letter.subject}**`);
    add(letter.salutation);
    for (const paragraph of letter.paragraphs) {
        if (!paragraph.empty) blocks.push(paragraph.markdown.trim());
    }
    add(letter.closing);
    add(sender.signatureName || sender.name);
    return `${blocks.join("\n\n")}\n`;
}
