import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The Word library is large, so the editor must only load it when someone exports (as the
 * CV editor does). Reading the sources is the cheapest way to keep that from regressing.
 */
const DIR = join(process.cwd(), "src", "components", "letters");
const sources = readdirSync(DIR)
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\./.test(file))
    .map((file) => ({ file, text: readFileSync(join(DIR, file), "utf8") }));

describe("the letter editor's bundle", () => {
    it("never imports the Word library, or the letter Word exporter, statically", () => {
        for (const { file, text } of sources) {
            expect(text, file).not.toMatch(/from\s+["']docx["']/);
            expect(text, file).not.toMatch(/from\s+["']@\/lib\/letters\/export-docx["']/);
            expect(text, file).not.toMatch(/from\s+["']@\/lib\/export-docx["']/);
        }
    });

    it("loads the Word exporter on demand, from the export function", () => {
        const run = readFileSync(join(process.cwd(), "src", "lib", "letters", "run-export.ts"), "utf8");
        expect(run).toMatch(/import\(["']\.\/export-docx["']\)/);
        expect(run).not.toMatch(/from\s+["']\.\/export-docx["']/);
    });
});
