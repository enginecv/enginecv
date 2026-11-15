import { describe, expect, it } from "vitest";
import { INTEREST_ICONS } from "./icon-catalog";
import { MAX_INTEREST_ICON_LENGTH, formatLucideIcon, parseInterestIcon } from "./icon";

describe("parseInterestIcon", () => {
    it("accepts a catalog icon", () => {
        expect(parseInterestIcon("lucide:guitar")).toEqual({ kind: "lucide", name: "guitar" });
        expect(parseInterestIcon(formatLucideIcon("mountain"))).toEqual({ kind: "lucide", name: "mountain" });
    });

    it("rejects an unknown or malformed icon name", () => {
        expect(parseInterestIcon("lucide:not-a-real-icon")).toBeNull();
        expect(parseInterestIcon("lucide:")).toBeNull();
        expect(parseInterestIcon("lucide:Guitar")).toBeNull();
        expect(parseInterestIcon("lucide: guitar")).toBeNull();
        expect(parseInterestIcon("lucid:guitar")).toBeNull();
    });

    it("accepts a single emoji, including multi-code-point ones", () => {
        expect(parseInterestIcon("🎸")).toEqual({ kind: "emoji", glyph: "🎸" });
        expect(parseInterestIcon("♟️")).toEqual({ kind: "emoji", glyph: "♟️" });
        expect(parseInterestIcon("👩‍💻")).toEqual({ kind: "emoji", glyph: "👩‍💻" }); // ZWJ sequence
        expect(parseInterestIcon("🇧🇦")).toEqual({ kind: "emoji", glyph: "🇧🇦" }); // flag
        expect(parseInterestIcon("👍🏽")).toEqual({ kind: "emoji", glyph: "👍🏽" }); // skin tone
        expect(parseInterestIcon("1️⃣")).toEqual({ kind: "emoji", glyph: "1️⃣" }); // keycap
    });

    it("trims surrounding whitespace around an emoji", () => {
        expect(parseInterestIcon("  🎸 ")).toEqual({ kind: "emoji", glyph: "🎸" });
    });

    it("rejects more than one emoji, text, digits and symbols", () => {
        expect(parseInterestIcon("🎸🎹")).toBeNull();
        expect(parseInterestIcon("🎸 🎹")).toBeNull();
        expect(parseInterestIcon("guitar")).toBeNull();
        expect(parseInterestIcon("🎸x")).toBeNull();
        expect(parseInterestIcon("7")).toBeNull();
        expect(parseInterestIcon("<svg/>")).toBeNull();
    });

    it("returns null for empty, missing and non-string values", () => {
        expect(parseInterestIcon("")).toBeNull();
        expect(parseInterestIcon("   ")).toBeNull();
        expect(parseInterestIcon(undefined)).toBeNull();
        expect(parseInterestIcon(null)).toBeNull();
        expect(parseInterestIcon(42 as unknown)).toBeNull();
        expect(parseInterestIcon({} as unknown)).toBeNull();
    });

    it("rejects values longer than the allowed length", () => {
        const longFlagChain = "👩‍👩‍👧‍👦".repeat(10);
        expect(longFlagChain.length).toBeGreaterThan(MAX_INTEREST_ICON_LENGTH);
        expect(parseInterestIcon(longFlagChain)).toBeNull();
        expect(parseInterestIcon(`lucide:${"a".repeat(80)}`)).toBeNull();
    });

    it("every catalog icon round-trips through the parser", () => {
        for (const entry of INTEREST_ICONS) {
            expect(parseInterestIcon(formatLucideIcon(entry.name)), entry.name).toEqual({ kind: "lucide", name: entry.name });
        }
    });
});
