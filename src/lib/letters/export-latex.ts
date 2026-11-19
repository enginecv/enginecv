import { escapeLatex, markdownToLatex } from "@/lib/export-latex";
import type { ResolvedLetter } from "./resolve";

function lines(text: string): string[] {
    return text.split("\n").map((line) => line.trim()).filter(Boolean);
}

/** A language code is written into a comment, so only letters, digits and dashes may appear. */
const safeCode = (code: string) => code.replace(/[^A-Za-z0-9-]/g, "") || "en";

/**
 * The letter as a LaTeX document: one standard letter layout, not a copy of the CV's design. Every
 * piece of the person's text goes through `escapeLatex` (rich text through `markdownToLatex`), so
 * nothing typed can change the structure of the file or stop it compiling. Tokens are already
 * resolved, so no `{{token}}` can appear.
 */
export function toLetterLatex(letter: ResolvedLetter): string {
    const { sender } = letter;
    const paper = letter.paperSize === "letter" ? "letterpaper" : "a4paper";
    const german = letter.layout === "din5008";
    const e = (value: string) => escapeLatex(value);
    const contact = [sender.email, sender.phone, sender.website].filter(Boolean).map(e).join(" \\textperiodcentered{} ");

    const header = [
        sender.name && `{\\Large\\textbf{${e(sender.name)}}}`,
        sender.headline && e(sender.headline),
        contact,
        ...lines(sender.address).map(e),
    ].filter(Boolean).join(" \\\\\n");

    const recipient = [letter.recipient.name.trim(), ...lines(letter.recipient.address)].filter(Boolean).map(e).join(" \\\\\n");
    const paragraphs = letter.paragraphs.filter((paragraph) => !paragraph.empty).map((paragraph) => markdownToLatex(paragraph.markdown)).filter(Boolean);

    const body = [
        header && `\\noindent ${header}\\par`,
        letter.date && `\\vspace{1.5em}\n\\hfill ${e(letter.date)}\\par`,
        recipient && `\\vspace{1.5em}\n\\noindent ${recipient}\\par`,
        letter.subject.trim() && `\\vspace{1.5em}\n\\noindent\\textbf{${e(letter.subject)}}\\par`,
        letter.salutation.trim() && `\\vspace{1em}\n\\noindent ${e(letter.salutation)}\\par`,
        ...paragraphs,
        (letter.closing.trim() || sender.signatureName || sender.name) && `\\vspace{1em}\n\\noindent ${e(letter.closing)}\\par\n\\vspace{3em}\n\\noindent ${e(sender.signatureName || sender.name)}\\par`,
    ].filter(Boolean).join("\n\n");

    return [
        "% Cover letter exported from EngineCV.",
        "% This is a standard letter layout, not a copy of the design you chose in EngineCV:",
        "% fonts, colours and the photo are not included. Edit freely.",
        "%",
        "% Compile with XeLaTeX or LuaLaTeX (recommended: any language and script):",
        "%   xelatex letter.tex",
        `% Letter language: ${safeCode(letter.language)}`,
        "",
        `\\documentclass[11pt,${paper}]{article}`,
        "\\usepackage{iftex}",
        "\\ifPDFTeX",
        "  \\usepackage[utf8]{inputenc}",
        "  \\usepackage[T1]{fontenc}",
        "  \\usepackage{lmodern}",
        "  \\usepackage{textcomp}",
        "\\else",
        "  \\usepackage{fontspec}",
        "\\fi",
        german ? "\\usepackage[left=25mm,right=20mm,top=25mm,bottom=20mm]{geometry}" : "\\usepackage[margin=2.5cm]{geometry}",
        "\\usepackage{enumitem}",
        "\\usepackage[colorlinks=true,urlcolor=blue!50!black,linkcolor=blue!50!black]{hyperref}",
        "\\setlength{\\parindent}{0pt}",
        "\\setlength{\\parskip}{0.8em}",
        "\\pagestyle{empty}",
        "\\setlist{nosep,leftmargin=1.4em}",
        "",
        "\\begin{document}",
        "",
        body,
        "",
        "\\end{document}",
        "",
    ].join("\n");
}
