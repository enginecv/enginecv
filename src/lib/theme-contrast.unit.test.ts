import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./color-contrast";

// WCAG 2.1 AA for the app's semantic theme tokens (src/app/globals.css). Text
// tokens are used for body-size copy on every surface, so they need 4.5:1.
const TEXT_TOKENS = ["faint", "dim", "mid", "bright", "strong", "accent", "success", "danger"];
const SURFACE_TOKENS = ["surface-0", "surface-1", "surface-2", "surface-3", "surface-4", "surface-5"];
const BODY_TEXT_MINIMUM = 4.5;

function tokensFor(block: string): Record<string, string> {
    return Object.fromEntries(
        [...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)].map((match) => [match[1], match[2]]),
    );
}

const css = readFileSync("src/app/globals.css", "utf8");
const themes = {
    dark: tokensFor(css.slice(css.indexOf(":root {"), css.indexOf(":root[data-theme=\"light\"]"))),
    light: tokensFor(css.slice(css.indexOf(":root[data-theme=\"light\"]"), css.indexOf("@theme inline"))),
};

function mix(foreground: string, background: string, alpha: number): string {
    const channels = (hex: string) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
    const [fg, bg] = [channels(foreground), channels(background)];
    return `#${fg.map((value, index) => Math.round(value * alpha + bg[index] * (1 - alpha)).toString(16).padStart(2, "0")).join("")}`;
}

describe("theme token contrast", () => {
    it.each(Object.entries(themes))("%s theme: accent and success text stay readable on 10%% accent tints", (_theme, tokens) => {
        const failures: string[] = [];
        for (const text of ["accent", "success"]) {
            for (const surface of SURFACE_TOKENS) {
                const tinted = mix(tokens.accent, tokens[surface], 0.1);
                const ratio = contrastRatio(tokens[text], tinted);
                if (ratio < BODY_TEXT_MINIMUM) failures.push(`${text} on accent/10 over ${surface}: ${ratio.toFixed(2)}`);
            }
        }
        expect(failures).toEqual([]);
    });

    it.each(Object.entries(themes))("%s theme: text tokens keep their prominence order", (_theme, tokens) => {
        const order = ["faint", "dim", "mid", "bright", "strong"].map((token) => contrastRatio(tokens[token], tokens["surface-2"]));
        expect([...order].sort((a, b) => a - b)).toEqual(order);
    });

    it.each(Object.entries(themes))("%s theme: text tokens reach %s:1 on every surface", (_theme, tokens) => {
        const failures: string[] = [];
        for (const text of TEXT_TOKENS) {
            for (const surface of SURFACE_TOKENS) {
                expect(tokens[text], text).toBeDefined();
                expect(tokens[surface], surface).toBeDefined();
                const ratio = contrastRatio(tokens[text], tokens[surface]);
                if (ratio < BODY_TEXT_MINIMUM) failures.push(`${text} on ${surface}: ${ratio.toFixed(2)}`);
            }
        }
        expect(failures).toEqual([]);
    });
});
