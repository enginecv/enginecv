import { describe, expect, it } from "vitest";
import { buildExampleResume } from "@/lib/onboarding/create-example";
import { de as nurseDe } from "@/lib/onboarding/examples/nurse.de";
import { demoteHeadings, exampleTextHtml } from "./text-version";

describe("demoteHeadings", () => {
    it("moves h1 and h2 down two levels, opening and closing tags alike", () => {
        expect(demoteHeadings('<h1 style="color:#000">A</h1><h2>B</h2><p>x</p>')).toBe('<h3 style="color:#000">A</h3><h4>B</h4><p>x</p>');
    });

    it("leaves other tags alone, including ones that merely start with h", () => {
        expect(demoteHeadings("<hr><header>x</header><h3>y</h3>")).toBe("<hr><header>x</header><h3>y</h3>");
    });
});

describe("exampleTextHtml", () => {
    const resume = buildExampleResume(nurseDe(), "de", "Beispiel", 1_000);
    const html = exampleTextHtml(resume, "#222222");

    it("contains the CV text, in the CV's language", () => {
        expect(html).toContain("Amra Begović");
        expect(html).toContain("Intensivstation");
        expect(html).toContain("Universität Tuzla");
    });

    it("has no h1 or h2, so the page keeps the only h1", () => {
        expect(html).not.toMatch(/<h[12]\b/);
        expect(html).toMatch(/<h3\b/);
    });

    it("carries no hidden entries or script", () => {
        expect(html).not.toMatch(/<script/i);
    });
});
