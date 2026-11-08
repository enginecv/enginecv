import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { toDocumentModel } from "@/lib/document-model";
import { createQaEdgeCaseResume, createQaFullResume, createQaMinimalResume } from "@/lib/qa/sample-resumes";
import { createEmptyResume, resumeSchema } from "@/lib/schema";
import { CARD_BUDGET, toReadmeCard } from "./card";
import { toGithubReadme } from "./markdown";
import { defaultReadmeOptions } from "./options";
import { buildReadmePackage, README_FILES } from "./package";

const FORBIDDEN = [/href=/i, /url\(\s*['"]?http/i, /@import/i, /@font-face/i, /<script/i, /<image/i, /<foreignObject/i];

function texts(svg: string): string[] {
    return [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((match) => match[1]);
}

describe("toReadmeCard", () => {
    it.each(["light", "dark"] as const)("is self-contained in the %s variant", (variant) => {
        for (const create of [createQaFullResume, createQaMinimalResume, createQaEdgeCaseResume]) {
            const svg = toReadmeCard(toDocumentModel(create()), variant);
            expect(svg.startsWith("<svg xmlns=\"http://www.w3.org/2000/svg\"")).toBe(true);
            for (const pattern of FORBIDDEN) expect(svg).not.toMatch(pattern);
        }
    });

    it("differs between variants", () => {
        const model = toDocumentModel(createQaFullResume());
        expect(toReadmeCard(model, "light")).toContain("#ffffff");
        expect(toReadmeCard(model, "dark")).toContain("#0d1117");
    });

    it("shows name, headline, location, current role and at most 6 skills", () => {
        const svg = toReadmeCard(toDocumentModel(createQaFullResume()), "light");
        const lines = texts(svg);
        expect(lines[0]).toBe("Amina Šehić-Đurić");
        expect(lines).toContain("Sarajevo, Bosnia &amp; Herzegovina");
        expect(lines).toContain("Staff Engineer · Northwind Data");
        expect(svg.match(/rx="12"/g)!.length).toBeLessThanOrEqual(6);
    });

    it("escapes XML and shortens overlong text with an ellipsis", () => {
        const resume = resumeSchema.parse({
            ...createEmptyResume(),
            basics: { name: `<${"N".repeat(60)}>`, headline: `A & B ${"x".repeat(80)}` },
        });
        const svg = toReadmeCard(toDocumentModel(resume), "dark");
        const [name, headline] = texts(svg);
        expect(name.startsWith("&lt;")).toBe(true);
        expect(name.endsWith("…")).toBe(true);
        expect(headline).toContain("A &amp; B");
        expect(Array.from(headline.replace(/&amp;/g, "&")).length).toBeLessThanOrEqual(CARD_BUDGET.headline);
    });
});

describe("buildReadmePackage", () => {
    it("zips the README and both cards under the names the snippet references", () => {
        const model = toDocumentModel(createQaFullResume());
        const markdown = toGithubReadme(model, defaultReadmeOptions());
        const zip = unzipSync(buildReadmePackage({
            markdown,
            cardLight: toReadmeCard(model, "light"),
            cardDark: toReadmeCard(model, "dark"),
        }));

        expect(Object.keys(zip).sort()).toEqual([README_FILES.markdown, README_FILES.cardDark, README_FILES.cardLight].sort());
        expect(strFromU8(zip[README_FILES.markdown])).toBe(markdown);
        expect(markdown).toContain(`srcset="./${README_FILES.cardDark}"`);
        expect(markdown).toContain(`src="./${README_FILES.cardLight}"`);
        expect(strFromU8(zip[README_FILES.cardDark])).toContain("#0d1117");
    });
});
