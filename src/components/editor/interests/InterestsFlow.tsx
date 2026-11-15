import { Fragment, type ReactNode } from "react";
import type { InterestsDisplay, InterestsSeparator } from "@/lib/schema";

export interface FlowInterest {
    id?: string;
    name?: string;
    description?: string;
    icon?: string;
}

interface InterestsFlowProps {
    interests: FlowInterest[];
    /** The compact styles; `list` keeps the per-entry rendering and never comes here. */
    display: Exclude<InterestsDisplay, "list">;
    separator: InterestsSeparator;
    columns: number;
    showIcons: boolean;
    /** Shown for an interest without a name. */
    fallbackLabel: string;
    /** Entry title size in pt, taken from the entry layout so names match other sections. */
    titleFontSize: number;
    accentColor: string;
    /** Space below the block in px (matches the other section blocks). */
    itemSpacing: number;
    /** `data-nav-section` value so a click on an item targets this section. */
    navSection: string;
    /** Position of each shown interest in the full list (hidden ones are not shown). Defaults to the shown position. */
    sourceIndices?: number[];
    /** Returns the icon element for an interest, or null. Provided by the caller. */
    renderIcon?: (interest: FlowInterest) => ReactNode;
}

const SEPARATOR_GLYPH: Record<InterestsSeparator, string> = {
    dot: "·",
    comma: ",",
    pipe: "|",
    slash: "/",
};

/**
 * Inline, Chips and Icon grid layouts for the Interests section. All three render
 * the whole section as one block, so they cannot split across pages; they are
 * compact enough that this stays safe for long lists. Descriptions are not shown
 * here (the list style shows them) but stay saved on the interest.
 */
export function InterestsFlow({
    interests,
    display,
    separator,
    columns,
    showIcons,
    fallbackLabel,
    titleFontSize,
    accentColor,
    itemSpacing,
    navSection,
    sourceIndices,
    renderIcon,
}: InterestsFlowProps) {
    if (interests.length === 0) return null;

    const nameOf = (interest: FlowInterest) => interest.name?.trim() || fallbackLabel;
    const iconFor = (interest: FlowInterest): ReactNode => (showIcons && renderIcon ? renderIcon(interest) : null);
    const navAttrs = (index: number) => ({
        "data-testid": "resume-interest-item",
        "data-nav-section": navSection,
        "data-nav-entry-index": String(sourceIndices?.[index] ?? index),
        "data-nav-kind": "entry",
    });
    const blockStyle = { marginBottom: `${itemSpacing}px` };

    if (display === "inline") {
        return (
            <p
                data-testid="resume-interests-flow"
                data-display="inline"
                className="leading-relaxed"
                style={{ ...blockStyle, fontSize: `${titleFontSize}pt` }}
            >
                {interests.map((interest, index) => (
                    <Fragment key={interest.id || index}>
                        {index > 0 ? <span aria-hidden="true"> {SEPARATOR_GLYPH[separator]} </span> : null}
                        <span {...navAttrs(index)} className="font-medium">{nameOf(interest)}</span>
                    </Fragment>
                ))}
            </p>
        );
    }

    if (display === "chips") {
        return (
            <div
                data-testid="resume-interests-flow"
                data-display="chips"
                className="flex flex-wrap gap-x-2 gap-y-1.5"
                style={blockStyle}
            >
                {interests.map((interest, index) => {
                    const icon = iconFor(interest);
                    return (
                        <span
                            key={interest.id || index}
                            {...navAttrs(index)}
                            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium"
                            style={{ fontSize: `${titleFontSize * 0.92}pt`, borderColor: accentColor }}
                        >
                            {icon ? <span aria-hidden="true" className="inline-flex shrink-0 items-center" style={{ color: accentColor }}>{icon}</span> : null}
                            {nameOf(interest)}
                        </span>
                    );
                })}
            </div>
        );
    }

    // iconGrid
    const columnCount = Math.min(4, Math.max(1, Math.round(columns) || 1));
    const icons = interests.map(iconFor);
    const anyIcon = icons.some((icon) => icon != null);
    return (
        <div
            data-testid="resume-interests-flow"
            data-display="iconGrid"
            style={{
                ...blockStyle,
                display: "grid",
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                columnGap: "16px",
                rowGap: "8px",
            }}
        >
            {interests.map((interest, index) => (
                <span
                    key={interest.id || index}
                    {...navAttrs(index)}
                    className="inline-flex items-center gap-2 font-medium"
                    style={{ fontSize: `${titleFontSize}pt` }}
                >
                    {anyIcon ? (
                        // The slot is reserved for every cell so names stay aligned.
                        <span
                            data-testid="resume-interest-icon-slot"
                            aria-hidden="true"
                            className="inline-flex w-[1.1em] shrink-0 items-center justify-center"
                            style={{ color: accentColor }}
                        >
                            {icons[index]}
                        </span>
                    ) : null}
                    <span>{nameOf(interest)}</span>
                </span>
            ))}
        </div>
    );
}
