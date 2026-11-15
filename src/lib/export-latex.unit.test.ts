import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { toDocumentModel } from "./document-model";
import { escapeLatex, escapeUrl, markdownToLatex, toLatex } from "./export-latex";
import { createQaEdgeCaseResume, createQaFullResume, createQaMinimalResume, QA_HIDDEN_MARKER } from "./qa/sample-resumes";
import { createEmptyResume } from "./schema";

describe("escapeLatex", () => {
    it("escapes every character LaTeX treats as special", () => {
        expect(escapeLatex("& % $ # _ { } ~ ^ \\")).toBe(
            "\\& \\% \\$ \\# \\_ \\{ \\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{}",
        );
        expect(escapeLatex("<a|b>")).toBe("\\textless{}a\\textbar{}b\\textgreater{}");
        expect(escapeLatex("[x]")).toBe("{[}x{]}");
        expect(escapeLatex("`tick`")).toBe("\\textasciigrave{}tick\\textasciigrave{}");
    });

    it("keeps hyphens as typed instead of letting them become dashes", () => {
        expect(escapeLatex("a--b---c")).toBe("a-{}-b-{}-{}-c");
        expect(escapeLatex("well-known")).toBe("well-known");
    });

    it("turns line breaks and tabs into spaces and drops control characters", () => {
        expect(escapeLatex("one\ntwo\r\nthree\tfour")).toBe("one two three four");
        expect(escapeLatex("a\u0000b\u0007c")).toBe("abc");
    });

    it("leaves accented and non-Latin letters untouched", () => {
        const text = "Šđčćž Ünïcödé Ελληνικά Кириллица 日本語";
        expect(escapeLatex(text)).toBe(text);
    });

    it("shows text that looks like commands literally, never as commands", () => {
        const out = escapeLatex("\\end{document}\\input{/etc/passwd}\\write18{rm}");
        expect(out).not.toMatch(/(^|[^{])\\(end|input|write18)\b(?!\{\})/);
        expect(out.startsWith("\\textbackslash{}end\\{document\\}")).toBe(true);
        // No unescaped special character survives anywhere.
        const unescaped = out.replace(/\\(textbackslash|textasciitilde|textasciicircum|textless|textgreater|textbar|textasciigrave)\{\}|\\[{}$&#_%]/g, "");
        expect(unescaped).not.toMatch(/[\\{}$&#_%^~<>|`]/);
    });

    it("never leaves a special character unescaped, for any single character", () => {
        for (let code = 0; code < 0x250; code += 1) {
            const char = String.fromCharCode(code);
            const out = escapeLatex(`a${char}b`);
            const unescaped = out.replace(/\\(textbackslash|textasciitilde|textasciicircum|textless|textgreater|textbar|textasciigrave)\{\}|\\[{}$&#_%]|\{[[\]]\}/g, "");
            expect(unescaped, `U+${code.toString(16)}`).not.toMatch(/[\\{}$&#_%^~<>|`[\]]/);
        }
    });
});

describe("escapeUrl", () => {
    it("escapes what \\href reads specially and encodes what would end its argument", () => {
        expect(escapeUrl("https://x.dev/a?b=1&c=2#frag")).toBe("https://x.dev/a?b=1&c=2\\#frag");
        expect(escapeUrl("https://x.dev/100%")).toBe("https://x.dev/100\\%");
        expect(escapeUrl("https://x.dev/a b{c}")).toBe("https://x.dev/a\\%20b\\%7Bc\\%7D");
        expect(escapeUrl("https://x.dev/\\input")).toBe("https://x.dev/\\%5Cinput");
    });
});

describe("markdownToLatex", () => {
    it("converts emphasis, code, links and lists", () => {
        const out = markdownToLatex("Some **bold** and *italic* and `code_x` [site](https://example.com/a_b)\n\n- one\n- two & three\n\n1. first\n2. second");
        expect(out).toContain("\\textbf{bold}");
        expect(out).toContain("\\emph{italic}");
        expect(out).toContain("\\texttt{code\\_x}");
        expect(out).toContain("\\href{https://example.com/a_b}{site}");
        expect(out).toContain("\\begin{itemize}\n  \\item one\n  \\item two \\& three\n\\end{itemize}");
        expect(out).toContain("\\begin{enumerate}\n  \\item first\n  \\item second\n\\end{enumerate}");
    });

    it("keeps the spaces around emphasised words", () => {
        expect(markdownToLatex("rewrite the **replication** and *quorum* paths")).toBe(
            "rewrite the \\textbf{replication} and \\emph{quorum} paths",
        );
    });

    it("keeps a link whose address is not usable as plain text", () => {
        expect(markdownToLatex("[click](javascript:void)")).toBe("click");
    });
});

describe("toLatex", () => {
    const fullModel = () => toDocumentModel(createQaFullResume());

    it("is a complete document with the engine and layout noted at the top", () => {
        const tex = toLatex(fullModel());
        expect(tex.startsWith("% CV exported from EngineCV.")).toBe(true);
        expect(tex).toContain("XeLaTeX or LuaLaTeX");
        expect(tex).toContain("not a copy of the template");
        expect(tex).toContain("\\documentclass[11pt,a4paper]{article}");
        expect(tex.trimEnd().endsWith("\\end{document}")).toBe(true);
        expect((tex.match(/\\begin\{document\}/g) ?? []).length).toBe(1);
        expect(toLatex(fullModel(), { paperSize: "letter" })).toContain("letterpaper");
    });

    it("carries the name, every section heading in order, and links as clickable links", () => {
        const model = fullModel();
        const tex = toLatex(model);
        expect(tex).toContain(escapeLatex(model.basics.name));

        let last = -1;
        for (const section of model.sections) {
            if (section.entries.length === 0 && section.skillGroups.length === 0 && !section.text && section.tags.length === 0) continue;
            const at = tex.indexOf(`\\section*{${escapeLatex(section.heading)}}`);
            expect(at, section.heading).toBeGreaterThan(last);
            last = at;
        }
        expect(tex).toMatch(/\\href\{https?:\/\/[^}]+\}\{/);
        expect(tex).toMatch(/\\href\{mailto:/);
    });

    it("leaves out hidden content, like the other exports", () => {
        expect(toLatex(fullModel())).not.toContain(QA_HIDDEN_MARKER);
    });

    it("writes skill levels in words only when the meter is on", () => {
        const resume = createQaFullResume();
        resume.settings.skillsSection = { showLevels: true, levelStyle: "dots" };
        expect(toLatex(toDocumentModel(resume))).toMatch(/\(Expert\)|\(Proficient\)|\(Competent\)/);
        resume.settings.skillsSection = { showLevels: false, levelStyle: "dots" };
        expect(toLatex(toDocumentModel(resume))).not.toMatch(/\((Expert|Proficient|Competent|Amateur|Beginner)\)/);
    });

    it("builds a document even when there is almost nothing in the CV", () => {
        const empty = toLatex(toDocumentModel(createEmptyResume()));
        expect(empty).toContain("\\begin{document}");
        expect(empty.trimEnd().endsWith("\\end{document}")).toBe(true);
        expect(toLatex(toDocumentModel(createQaMinimalResume()))).toContain("\\end{document}");
    });

    it("keeps the edge-case CV's tricky text literal", () => {
        const tex = toLatex(toDocumentModel(createQaEdgeCaseResume()));
        // Only the generated preamble and our own commands may contain a backslash before a letter.
        const body = tex.slice(tex.indexOf("\\begin{document}"));
        expect(body).not.toMatch(/\\(write|input|include|openout|immediate)\b/);
    });

    it("builds a typical CV in well under a second", () => {
        const model = fullModel();
        const started = performance.now();
        toLatex(model);
        expect(performance.now() - started).toBeLessThan(1000);
    });
});

// Real compilation, only when asked for (CI has no TeX toolchain):
//   ENGINECV_LATEX_COMPILE=1 npx vitest run src/lib/export-latex.unit.test.ts
const compile = process.env.ENGINECV_LATEX_COMPILE === "1" ? describe : describe.skip;

compile("compiling the exported file", () => {
    const hostile = () => {
        // Latin-only base, so pdfLaTeX can compile it as well.
        const resume = createQaMinimalResume();
        resume.basics.name = "Ana & Bob_50% $5 #1 {x} ~^ \\end{document}";
        resume.basics.summary = "**bold & fine** 100% [a](https://example.com/a_b?x=1&y=2#f)\n\n- item_1\n- item {2}";
        resume.settings.contentSections = ["experience"];
        const body = "- did 100% of **x_y**\n- \\input{nope} and $$ and ^_^";
        resume.experience = [{ id: "e", hidden: false, company: "Acme_&_Co #1", position: "Lead -- Senior --- Dev <b>|</b> `ticks` [brackets] {x}", start: "2020-01", end: "Present", location: "", description: body, highlights: [], skills: [], url: "", urlIcon: "auto" }] as never;
        return resume;
    };

    for (const [label, build] of [
        ["full", createQaFullResume],
        ["minimal", createQaMinimalResume],
        ["edge cases", createQaEdgeCaseResume],
        ["hostile text", hostile],
    ] as const) {
        for (const engine of ["xelatex", "pdflatex"] as const) {
            it(`${label} compiles with ${engine}`, () => {
                const resume = build();
                // pdfLaTeX needs Latin text; the non-Latin fixtures are an XeLaTeX case.
                if (engine === "pdflatex" && /[^\u0000-\u024f\u2000-\u206f€•]/.test(JSON.stringify(resume))) return;
                const dir = fs.mkdtempSync(path.join(os.tmpdir(), "enginecv-tex-"));
                const file = path.join(dir, "cv.tex");
                fs.writeFileSync(file, toLatex(toDocumentModel(resume)));
                execFileSync(engine, ["-interaction=nonstopmode", "-halt-on-error", "--enable-installer", "cv.tex"], {
                    cwd: dir,
                    stdio: "pipe",
                    timeout: 240_000,
                });
                expect(fs.existsSync(path.join(dir, "cv.pdf"))).toBe(true);
            }, 300_000);
        }
    }
});
