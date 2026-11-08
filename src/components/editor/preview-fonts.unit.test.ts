import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PRESET_FONTS } from "@/lib/fonts";
import { getBuiltinTemplates } from "@/lib/templates/enginecv-templates";
import { SELF_HOSTED_FONT_FAMILIES } from "./preview-fonts";

const require = createRequire(import.meta.url);

// Installed on every operating system EngineCV targets; never fetched.
const SYSTEM_FONTS = new Set(["Georgia", "Arial", "Helvetica", "Times New Roman", "Courier New", "serif", "sans-serif", "monospace"]);

function collectFontFamilies(value: unknown, found = new Set<string>()): Set<string> {
    if (Array.isArray(value)) {
        for (const item of value) collectFontFamilies(item, found);
    } else if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
            if (key === "fontFamily" && typeof child === "string" && child.trim() && !child.startsWith("var:")) {
                found.add(child.trim());
            } else {
                collectFontFamilies(child, found);
            }
        }
    }
    return found;
}

describe("self-hosted preview fonts", () => {
    it("covers every preset font", () => {
        for (const family of PRESET_FONTS) {
            expect(SELF_HOSTED_FONT_FAMILIES, family).toContain(family);
        }
    });

    it("covers every font a built-in template uses", () => {
        const families = collectFontFamilies(getBuiltinTemplates());
        const missing = [...families].filter(
            (family) => !SYSTEM_FONTS.has(family) && !(SELF_HOSTED_FONT_FAMILIES as readonly string[]).includes(family),
        );
        expect(families.size).toBeGreaterThan(0);
        expect(missing).toEqual([]);
    });

    it("imports a font face for each self-hosted family", () => {
        const source = readFileSync("src/components/editor/preview-fonts.ts", "utf8");
        const imported = [...source.matchAll(/^import "(@fontsource\/[^"]+\.css)";$/gm)].map((match) => match[1]);
        const registered = new Set(
            imported.flatMap((file) => [...readFileSync(require.resolve(file), "utf8").matchAll(/font-family: '([^']+)'/g)].map((match) => match[1])),
        );

        for (const family of SELF_HOSTED_FONT_FAMILIES) {
            expect(registered, family).toContain(family);
        }
    });

    it("offers every self-hosted family in the font picker", () => {
        expect([...PRESET_FONTS].sort()).toEqual([...SELF_HOSTED_FONT_FAMILIES].sort());
    });

    it("ships every weight and italic each font package provides", () => {
        const source = readFileSync("src/components/editor/preview-fonts.ts", "utf8");
        const imported = new Set([...source.matchAll(/^import "@fontsource\/([^"]+\.css)";$/gm)].map((match) => match[1]));
        const packages = new Set([...imported].map((file) => file.split("/")[0]));

        for (const pkg of packages) {
            const packageDir = path.dirname(require.resolve(`@fontsource/${pkg}/package.json`));
            const styles = readdirSync(packageDir).filter((file) => /^\d+(-italic)?\.css$/.test(file));
            expect(styles.length, pkg).toBeGreaterThan(0);
            for (const file of styles) expect(imported, `${pkg}/${file}`).toContain(`${pkg}/${file}`);
        }
    });

    it("loads no fonts from a third-party font host in the resume preview", () => {
        const preview = readFileSync("src/components/editor/ResumePreview.tsx", "utf8");

        expect(preview).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
        expect(preview).toContain('import "./preview-fonts";');
    });
});
