import { getInterestIcon } from "./icon-catalog";

/**
 * One place decides what an interest's `icon` string means, so the picker, the
 * preview and any exporter never re-implement the rules.
 *
 * Stored value is either `lucide:<catalog-name>` or a single emoji. Anything
 * else (empty, unknown name, several emoji, plain text, too long) means "no
 * icon" and is never an error, so old or hand-edited files still open.
 */
export type InterestIcon =
    | { kind: "lucide"; name: string }
    | { kind: "emoji"; glyph: string };

/** UTF-16 code units for an emoji; a family emoji is 11, a long ZWJ chain stays well under this. */
export const MAX_INTEREST_ICON_LENGTH = 16;
/** Longest stored value overall, including the `lucide:` prefix (matches the schema bound). */
export const MAX_STORED_ICON_LENGTH = 64;

const LUCIDE_PREFIX = "lucide:";
const LUCIDE_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function formatLucideIcon(name: string): string {
    return `${LUCIDE_PREFIX}${name}`;
}

function countGraphemes(text: string): number {
    if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
        const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
        return Array.from(segmenter.segment(text)).length;
    }
    // Fallback for very old engines: count code points that are not joiners,
    // variation selectors, skin tones or combining marks.
    return Array.from(text).filter((char) => !/[‍️⃣\u{1f3fb}-\u{1f3ff}]/u.test(char) && !/\p{M}/u.test(char)).length;
}

export function parseInterestIcon(value: unknown): InterestIcon | null {
    if (typeof value !== "string") return null;
    const text = value.trim();
    if (!text || text.length > MAX_STORED_ICON_LENGTH) return null;

    if (text.startsWith(LUCIDE_PREFIX)) {
        const name = text.slice(LUCIDE_PREFIX.length);
        if (!LUCIDE_NAME.test(name)) return null;
        return getInterestIcon(name) ? { kind: "lucide", name } : null;
    }

    // A single emoji: exactly one grapheme that contains a pictographic code
    // point (or a keycap / regional-indicator flag).
    if (text.length > MAX_INTEREST_ICON_LENGTH) return null;
    if (!/\p{Extended_Pictographic}|⃣|\p{Regional_Indicator}/u.test(text)) return null;
    if (countGraphemes(text) !== 1) return null;
    return { kind: "emoji", glyph: text };
}
