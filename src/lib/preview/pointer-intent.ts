/**
 * Pointer rules for the editor's live preview, kept pure so the click and
 * double-click handlers in ResumePreview share one tested decision table.
 *
 * - A plain click on a selectable element opens the Go to / Customize menu,
 *   even when the click lands on a link. Ctrl/Cmd+click follows the link.
 * - Double-clicking a section heading or an entry navigates to it. Editable text
 *   keeps its own double-click (inline edit) unless Alt is held.
 */

export interface ClickInput {
    thumbnailMode: boolean;
    button: number;
    /** `MouseEvent.detail`: 1 for a single click, 2+ for repeated clicks. */
    detail: number;
    didDrag: boolean;
    spaceHeld: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    isContentEditable: boolean;
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
    /** Cancel a pending menu (second click of a double-click). */
    | { kind: "cancel-timer"; preventDefault: boolean }
    /** Click landed outside any selectable element: close the menu. */
    | { kind: "close-menu" }
    /** Prevent default and open the menu after the double-click window. */
    | { kind: "open-menu"; href: string | null };

export function decideClick(input: ClickInput): ClickDecision {
    if (input.thumbnailMode) return { kind: "ignore" };
    if (input.button !== 0 || input.didDrag || input.spaceHeld) return { kind: "ignore" };
    // Clicks inside an actively edited element place the caret.
    if (input.isContentEditable) return { kind: "ignore" };

    const hasLink = input.linkHref != null;

    // Ctrl/Cmd+click on a link follows it on purpose.
    if (hasLink && (input.ctrlKey || input.metaKey)) return { kind: "native", closeMenu: true };

    // A link with nothing selectable around it keeps normal link behaviour, so
    // the click is never swallowed with no menu to show.
    if (hasLink && input.navSection == null) return { kind: "native", closeMenu: true };

    // Second click of a double-click: cancel the deferred menu. A link inside a
    // selectable element must still not be followed.
    if (input.detail >= 2) return { kind: "cancel-timer", preventDefault: hasLink };

    if (input.navSection == null) return { kind: "close-menu" };

    return { kind: "open-menu", href: input.linkHref };
}

export interface DoubleClickInput {
    thumbnailMode: boolean;
    /** Alt/Option held: navigate even from inline-editable text. */
    altKey: boolean;
    isContentEditable: boolean;
    /** True when the target is inside an inline-editable field. */
    hasEditableAncestor: boolean;
    navSection: string | null;
    /** "heading" for a section heading, "entry" for an entry. */
    navKind: string | null;
    /** Index of the entry inside its section, when the target is an entry. */
    navEntryIndex: number | null;
}

export type DoubleClickDecision =
    | { kind: "ignore" }
    | { kind: "navigate"; section: string; entryIndex: number | null };

export function decideDoubleClick(input: DoubleClickInput): DoubleClickDecision {
    if (input.thumbnailMode) return { kind: "ignore" };
    // Never hijack a double-click inside text that is being edited right now.
    if (input.isContentEditable) return { kind: "ignore" };
    // Editable text keeps its own double-click unless Alt asks to navigate.
    if (input.hasEditableAncestor && !input.altKey) return { kind: "ignore" };
    if (input.navSection == null) return { kind: "ignore" };
    if (input.navKind === "heading") return { kind: "navigate", section: input.navSection, entryIndex: null };
    if (input.navKind === "entry") return { kind: "navigate", section: input.navSection, entryIndex: input.navEntryIndex };
    return { kind: "ignore" };
}
