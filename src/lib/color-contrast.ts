/**
 * Accent colours are picked against the preview's theme, so a light accent
 * (the dark-theme default `#ffaa8d`) can be unreadable on the white page of an
 * exported document. These helpers darken such a colour just enough to read.
 */

const FALLBACK = "#111827";
const MIN_CONTRAST_ON_WHITE = 3;

/** `#abc` / `#aabbcc` (case-insensitive, optional `#`) → `#aabbcc`, else null. */
export function normalizeHex(value: string): string | null {
    const hex = value.trim().replace(/^#/, "").toLowerCase();
    if (/^[0-9a-f]{3}$/.test(hex)) return `#${hex.split("").map((char) => char + char).join("")}`;
    if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
    return null;
}

function channels(hex: string): [number, number, number] {
    return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)) as [number, number, number];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
    const linear = (channel: number) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastOnWhite(hex: string): number {
    return 1.05 / (relativeLuminance(channels(hex)) + 0.05);
}

function toHex(rgb: number[]): string {
    return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

/** Returns the accent unchanged when readable on white, otherwise the lightest darker shade that is. */
export function ensureReadableAccent(value: string): string {
    const hex = normalizeHex(value);
    if (!hex) return FALLBACK;
    if (contrastOnWhite(hex) >= MIN_CONTRAST_ON_WHITE) return hex;

    // Scale towards black in small steps; hue is preserved and the result stays
    // as close to the original as the contrast floor allows.
    const rgb = channels(hex);
    for (let factor = 0.95; factor > 0; factor -= 0.05) {
        const candidate = toHex(rgb.map((channel) => channel * factor));
        if (contrastOnWhite(candidate) >= MIN_CONTRAST_ON_WHITE) return candidate;
    }
    return FALLBACK;
}

/** WCAG contrast ratio between two colours (1–21). Throws on invalid hex. */
export function contrastRatio(foreground: string, background: string): number {
    const fg = normalizeHex(foreground);
    const bg = normalizeHex(background);
    if (!fg || !bg) throw new Error(`Invalid colour: ${foreground} on ${background}`);
    const [lighter, darker] = [relativeLuminance(channels(fg)), relativeLuminance(channels(bg))].sort((a, b) => b - a);
    return (lighter + 0.05) / (darker + 0.05);
}
