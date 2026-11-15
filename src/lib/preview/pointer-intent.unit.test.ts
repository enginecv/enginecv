import { describe, expect, it } from "vitest";
import { decideClick, decideDoubleClick, type ClickInput, type DoubleClickInput } from "./pointer-intent";

function click(overrides: Partial<ClickInput> = {}): ClickInput {
    return {
        thumbnailMode: false,
        button: 0,
        detail: 1,
        didDrag: false,
        spaceHeld: false,
        ctrlKey: false,
        metaKey: false,
        isContentEditable: false,
        linkHref: null,
        navSection: "experience",
        ...overrides,
    };
}

function dbl(overrides: Partial<DoubleClickInput> = {}): DoubleClickInput {
    return {
        thumbnailMode: false,
        isContentEditable: false,
        hasEditableAncestor: false,
        navSection: "experience",
        navKind: "heading",
        ...overrides,
    };
}

describe("decideClick", () => {
    it("ignores clicks in thumbnails, drags, Space-pans, non-left buttons and active edits", () => {
        expect(decideClick(click({ thumbnailMode: true }))).toEqual({ kind: "ignore" });
        expect(decideClick(click({ didDrag: true }))).toEqual({ kind: "ignore" });
        expect(decideClick(click({ spaceHeld: true }))).toEqual({ kind: "ignore" });
        expect(decideClick(click({ button: 1 }))).toEqual({ kind: "ignore" });
        expect(decideClick(click({ button: 2 }))).toEqual({ kind: "ignore" });
        expect(decideClick(click({ isContentEditable: true }))).toEqual({ kind: "ignore" });
    });

    it("opens the menu for a plain click on non-link content", () => {
        expect(decideClick(click())).toEqual({ kind: "open-menu", href: null });
    });

    it("opens the menu with the href for a plain click on a link inside a nav target", () => {
        expect(decideClick(click({ linkHref: "https://example.com/x" }))).toEqual({
            kind: "open-menu",
            href: "https://example.com/x",
        });
        expect(decideClick(click({ linkHref: "mailto:a@b.co" }))).toEqual({
            kind: "open-menu",
            href: "mailto:a@b.co",
        });
    });

    it("lets Ctrl+click and Cmd+click follow a link natively and closes the menu", () => {
        expect(decideClick(click({ linkHref: "https://example.com", ctrlKey: true }))).toEqual({
            kind: "native",
            closeMenu: true,
        });
        expect(decideClick(click({ linkHref: "https://example.com", metaKey: true }))).toEqual({
            kind: "native",
            closeMenu: true,
        });
    });

    it("does not treat the modifier as special on non-link content", () => {
        expect(decideClick(click({ ctrlKey: true }))).toEqual({ kind: "open-menu", href: null });
    });

    it("keeps native behaviour for a link with no nav target", () => {
        expect(decideClick(click({ linkHref: "https://example.com", navSection: null }))).toEqual({
            kind: "native",
            closeMenu: true,
        });
    });

    it("closes the menu when a non-link click lands outside any nav target", () => {
        expect(decideClick(click({ navSection: null }))).toEqual({ kind: "close-menu" });
    });

    it("cancels the pending menu on the second click of a double-click", () => {
        expect(decideClick(click({ detail: 2 }))).toEqual({ kind: "cancel-timer", preventDefault: false });
    });

    it("still blocks link navigation on the second click of a double-click inside a nav target", () => {
        expect(decideClick(click({ detail: 2, linkHref: "https://example.com" }))).toEqual({
            kind: "cancel-timer",
            preventDefault: true,
        });
    });

    it("lets a modified double-click on a link follow it", () => {
        expect(decideClick(click({ detail: 2, linkHref: "https://example.com", ctrlKey: true }))).toEqual({
            kind: "native",
            closeMenu: true,
        });
    });
});

describe("decideDoubleClick", () => {
    it("navigates to the section when a heading is double-clicked", () => {
        expect(decideDoubleClick(dbl())).toEqual({ kind: "navigate", section: "experience" });
    });

    it("never navigates from editable text or an active edit", () => {
        expect(decideDoubleClick(dbl({ hasEditableAncestor: true }))).toEqual({ kind: "ignore" });
        expect(decideDoubleClick(dbl({ isContentEditable: true }))).toEqual({ kind: "ignore" });
    });

    it("ignores entry targets, unmarked targets and thumbnails", () => {
        expect(decideDoubleClick(dbl({ navKind: "entry" }))).toEqual({ kind: "ignore" });
        expect(decideDoubleClick(dbl({ navKind: null, navSection: null }))).toEqual({ kind: "ignore" });
        expect(decideDoubleClick(dbl({ navSection: null }))).toEqual({ kind: "ignore" });
        expect(decideDoubleClick(dbl({ thumbnailMode: true }))).toEqual({ kind: "ignore" });
    });
});
