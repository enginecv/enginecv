import { describe, it, expect } from "vitest";
import {
    getRoleFonts,
    roleRef,
    parseRoleRef,
    roleFontStack,
    fontFamilyCssValue,
    fontFamilyInlineValue,
} from "./fonts";

describe("getRoleFonts", () => {
    it("defaults every role to the body font when roles are unset", () => {
        const roles = getRoleFonts({ fontFamily: "Merriweather" });
        expect(roles).toEqual({ primary: "Merriweather", secondary: "Merriweather", mono: "Merriweather" });
    });

    it("falls back to Inter when no body font is set", () => {
        expect(getRoleFonts(undefined)).toEqual({ primary: "Inter", secondary: "Inter", mono: "Inter" });
    });

    it("uses explicit primary/mono and treats secondary as the body font", () => {
        const roles = getRoleFonts({
            fontFamily: "Roboto",
            fonts: { primary: "Playfair Display", mono: "Inconsolata" },
        });
        expect(roles).toEqual({ primary: "Playfair Display", secondary: "Roboto", mono: "Inconsolata" });
    });

    it("lets fonts.secondary override the body font for all fallbacks", () => {
        const roles = getRoleFonts({ fontFamily: "Roboto", fonts: { secondary: "Lato" } });
        expect(roles).toEqual({ primary: "Lato", secondary: "Lato", mono: "Lato" });
    });
});

describe("role references", () => {
    it("round-trips a role ref", () => {
        expect(parseRoleRef(roleRef("mono"))).toBe("mono");
    });
    it("returns null for literals and empty values", () => {
        expect(parseRoleRef("Inter")).toBeNull();
        expect(parseRoleRef("")).toBeNull();
        expect(parseRoleRef("var:bogus")).toBeNull();
    });
});

describe("roleFontStack", () => {
    it("uses monospace generic for mono, sans-serif otherwise", () => {
        const roles = getRoleFonts({ fontFamily: "Roboto", fonts: { mono: "Inconsolata" } });
        expect(roleFontStack("primary", roles)).toBe('"Roboto", sans-serif');
        expect(roleFontStack("mono", roles)).toBe('"Inconsolata", monospace');
    });
});

describe("fontFamilyCssValue", () => {
    it("emits the default-role var for empty values", () => {
        expect(fontFamilyCssValue("", "primary")).toBe("var(--font-primary)");
    });
    it("emits the referenced-role var for role refs", () => {
        expect(fontFamilyCssValue("var:mono", "primary")).toBe("var(--font-mono)");
    });
    it("quotes literal families with a generic fallback", () => {
        expect(fontFamilyCssValue("Playfair Display", "primary")).toBe('"Playfair Display", sans-serif');
        expect(fontFamilyCssValue("Inconsolata", "mono")).toBe('"Inconsolata", monospace');
    });
});

describe("fontFamilyInlineValue", () => {
    it("emits a var for empty and role-ref values", () => {
        expect(fontFamilyInlineValue("", "mono")).toBe("var(--font-mono)");
        expect(fontFamilyInlineValue("var:primary", "mono")).toBe("var(--font-primary)");
    });
    it("emits the bare family for literals", () => {
        expect(fontFamilyInlineValue("Roboto", "mono")).toBe("Roboto");
    });
});
