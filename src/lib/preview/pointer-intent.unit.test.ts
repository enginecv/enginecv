import { describe, expect, it } from "vitest";
import { decideClick, type ClickInput } from "./pointer-intent";

function click(overrides: Partial<ClickInput> = {}): ClickInput {
    return {
        thumbnailMode: false,
        button: 0,
        didDrag: false,
        spaceHeld: false,
        ctrlKey: false,
        metaKey: false,
        linkHref: null,
        navSection: "experience",
        ...overrides,
    };
}

describe("decideClick", () => {
    it("ignores clicks in thumbnails, drags, Space-pans and non-left buttons", () => {
        expect(decideClick(click({ thumbnailMode: true }))).toEqual({ kind: "ignore" });
        expect(decideClick(click({ didDrag: true }))).toEqual({ kind: "ignore" });
        expect(decideClick(click({ spaceHeld: true }))).toEqual({ kind: "ignore" });
        expect(decideClick(click({ button: 1 }))).toEqual({ kind: "ignore" });
        expect(decideClick(click({ button: 2 }))).toEqual({ kind: "ignore" });
    });

    it("opens the menu for a plain click on non-link content", () => {
        expect(decideClick(click())).toEqual({ kind: "open-menu", href: null });
    });

    it("opens the menu with the href for a plain click on a link inside a nav target", () => {
        expect(decideClick(click({ linkHref: "https://example.com/x" }))).toEqual({ kind: "open-menu", href: "https://example.com/x" });
        expect(decideClick(click({ linkHref: "mailto:a@b.co" }))).toEqual({ kind: "open-menu", href: "mailto:a@b.co" });
    });

    it("lets Ctrl+click and Cmd+click follow a link natively and closes the menu", () => {
        expect(decideClick(click({ linkHref: "https://example.com", ctrlKey: true }))).toEqual({ kind: "native", closeMenu: true });
        expect(decideClick(click({ linkHref: "https://example.com", metaKey: true }))).toEqual({ kind: "native", closeMenu: true });
    });

    it("keeps normal link behaviour for a link outside any nav target", () => {
        expect(decideClick(click({ linkHref: "https://example.com", navSection: null }))).toEqual({ kind: "native", closeMenu: true });
    });

    it("closes the menu when the click lands outside any nav target", () => {
        expect(decideClick(click({ navSection: null }))).toEqual({ kind: "close-menu" });
    });

    it("treats a repeated click like a single one: nothing waits for a double-click", () => {
        expect(decideClick(click())).toEqual(decideClick(click()));
    });
});
