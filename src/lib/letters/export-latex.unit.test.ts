import { describe, expect, it } from "vitest";
import { makeCv, makeLetter } from "../../../test/setup/letter-fixtures";
import { toLetterLatex } from "./export-latex";
import { resolveLetter } from "./resolve";

const tex = (overrides = {}, cv = makeCv()) => toLetterLatex(resolveLetter(makeLetter(overrides), cv));

describe("toLetterLatex", () => {
    it("is a complete document with the letter's content in reading order", () => {
        const out = tex({ subject: "Application as Designer", recipient: { name: "Frau Roe", address: "Acme GmbH\n20095 Hamburg" } });
        expect(out).toContain("\\documentclass[11pt,a4paper]{article}");
        expect(out).toContain("\\begin{document}");
        expect(out.trimEnd().endsWith("\\end{document}")).toBe(true);
        const order = ["Amina Hodzic", "November 18, 2026", "Frau Roe", "Application as Designer", "Dear Hiring Team,", "excited", "Kind regards,"];
        const positions = order.map((part) => out.indexOf(part));
        expect(positions.every((position) => position >= 0)).toBe(true);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });

    it("escapes everything the person types so it cannot change the document", () => {
        const out = tex({ company: "R&D", recipient: { name: "A & B #1 100%", address: "_x_ {y} $z$ ~" }, subject: "50% \\end{document}", paragraphs: [{ id: "a", markdown: "Cost: $5 & 10% off \\input{x}", prompt: "" }] });
        expect(out).toContain("A \\& B \\#1 100\\%");
        expect(out).toContain("\\textbackslash{}end\\{document\\}");
        expect(out).toContain("\\textbackslash{}input\\{x\\}");
        expect(out.match(/\\end\{document\}/g)).toHaveLength(1);
        expect(out.match(/\\begin\{document\}/g)).toHaveLength(1);
    });

    it("keeps bold, italic, links and lists from the paragraphs", () => {
        const out = tex({ paragraphs: [{ id: "a", markdown: "I am **bold** and *slanted*.\n\n- one\n- two\n\nSee [my site](https://example.com).", prompt: "" }] });
        expect(out).toContain("\\textbf{bold}");
        expect(out).toContain("\\emph{slanted}");
        expect(out).toContain("\\begin{itemize}");
        expect(out).toContain("\\href{https://example.com}");
    });

    it("never contains token syntax, and skips empty paragraphs", () => {
        const out = tex({ subject: "{{role}}", paragraphs: [{ id: "a", markdown: "", prompt: "hint" }, { id: "b", markdown: "{{name}} {{nothing}}", prompt: "" }] });
        expect(out).not.toContain("{{");
        expect(out).toContain("Senior Product Designer");
    });

    it("uses the letter's paper size, and the German margins for the German layout", () => {
        expect(tex({ paperSize: "letter" })).toContain("letterpaper");
        const german = tex({ layout: "din5008", paperSize: "a4" });
        expect(german).toContain("left=25mm,right=20mm");
        expect(tex()).toContain("margin=2.5cm");
    });

    it("keeps a hostile language code out of the comment line", () => {
        const out = tex({ language: "en\n\\end{document}" });
        expect(out).toContain("% Letter language: en");
        expect(out.match(/\\end\{document\}/g)).toHaveLength(1);
    });
});
