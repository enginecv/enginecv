import { getInterestIcon } from "@/lib/interests/icon-catalog";
import { parseInterestIcon } from "@/lib/interests/icon";

/**
 * Renders an interest's icon: an inline SVG for catalog icons (vector, so it
 * stays crisp in PDF export) or the emoji glyph as text. Returns null when the
 * stored value is empty or unusable, so a bad value never shows an error.
 * Always decorative: the interest name carries the meaning.
 */
export function InterestIconView({ value, className }: { value: string | null | undefined; className?: string }) {
    const parsed = parseInterestIcon(value);
    if (!parsed) return null;

    if (parsed.kind === "emoji") {
        return (
            <span
                data-testid="interest-icon-emoji"
                aria-hidden="true"
                className={className}
                style={{ lineHeight: 1, fontSize: "1em" }}
            >
                {parsed.glyph}
            </span>
        );
    }

    const entry = getInterestIcon(parsed.name);
    if (!entry) return null;
    const Icon = entry.icon;
    return <Icon data-testid="interest-icon-svg" aria-hidden="true" className={className} style={{ width: "1em", height: "1em" }} />;
}
