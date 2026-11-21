/**
 * Pointer rules for the editor's live preview, kept pure so the click handler in ResumePreview uses one
 * tested decision table. The preview does not edit text; a click only navigates.
 *
 * - A plain click on a selectable element opens the Go to / Customize menu, even when the click lands on
 *   a link (the menu then offers "Open link").
 * - Ctrl/Cmd+click on a link follows it.
 */

export interface ClickInput {
    thumbnailMode: boolean;
    button: number;
    didDrag: boolean;
    spaceHeld: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    /** `href` of the closest `a[href]` under the pointer, or null. */
    linkHref: string | null;
    /** `data-nav-section` of the closest selectable element, or null. */
    navSection: string | null;
}

export type ClickDecision =
    /** Do nothing and leave the event alone. */
    | { kind: "ignore" }
    /** Let the browser handle the click (link follow). Optionally close the menu. */
    | { kind: "native"; closeMenu: boolean }
    /** Click landed outside any selectable element: close the menu. */
    | { kind: "close-menu" }
    /** Prevent default and open the menu. */
    | { kind: "open-menu"; href: string | null };

export function decideClick(input: ClickInput): ClickDecision {
    if (input.thumbnailMode) return { kind: "ignore" };
    if (input.button !== 0 || input.didDrag || input.spaceHeld) return { kind: "ignore" };

    const hasLink = input.linkHref != null;

    // Ctrl/Cmd+click on a link follows it on purpose.
    if (hasLink && (input.ctrlKey || input.metaKey)) return { kind: "native", closeMenu: true };

    // A link with nothing selectable around it keeps normal link behaviour, so
    // the click is never swallowed with no menu to show.
    if (hasLink && input.navSection == null) return { kind: "native", closeMenu: true };

    if (input.navSection == null) return { kind: "close-menu" };

    return { kind: "open-menu", href: input.linkHref };
}
