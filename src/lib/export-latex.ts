import type { DocumentDetail, DocumentEntry, DocumentLink, DocumentModel, DocumentSection } from "./document-model";
import { formatDocumentSkills, toDocumentLink } from "./document-model";
import { parseMarkdownBlocks, type InlineToken } from "./markdown-inline";

/**
 * LaTeX serializer over the document model.
 *
 * One classic CV layout, not a copy of the chosen template: fonts, colours,
 * columns and the photo do not carry over. Every piece of user text goes through
 * `escapeLatex` (or `escapeUrl` inside a link target), so nothing a user types can
 * change the structure of the document or stop it compiling.
 */

export interface LatexExportOptions {
    paperSize?: "a4" | "letter";
}

const SPECIAL: Record<string, string> = {
    "\\": "\\textbackslash{}",
    "{": "\\{",
    "}": "\\}",
    "$": "\\$",
    "&": "\\&",
    "#": "\\#",
    "^": "\\textasciicircum{}",
    "_": "\\_",
    "~": "\\textasciitilde{}",
    "%": "\\%",
    "<": "\\textless{}",
    ">": "\\textgreater{}",
    "|": "\\textbar{}",
    // Brackets are taken as an optional argument right after a line break or a macro.
    "[": "{[}",
    "]": "{]}",
    "`": "\\textasciigrave{}",
};

/** Control characters other than tab and line breaks have no place in a text file. */
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/**
 * Makes arbitrary text safe to place in a LaTeX document. The output is plain
 * text: it contains no unescaped special character, and line breaks and tabs
 * become spaces (paragraph structure is built by the serializer, not by the text).
 */
export function escapeLatex(value: string): string {
    return value
        .replace(CONTROL, "")
        .replace(/[\t\r\n]+/g, " ")
        .replace(/[\\{}$&#^_~%<>|[\]`]/g, (char) => SPECIAL[char])
        // `--` and `---` would print as dashes; the user typed hyphens.
        .replace(/-(?=-)/g, "-{}");
}

/**
 * Makes a URL safe for the first argument of \href: characters that end or
 * reshape the argument are percent-encoded, and `%` and `#` (which \href reads as
 * a comment and a parameter) are escaped.
 */
export function escapeUrl(url: string): string {
    return url
        .replace(CONTROL, "")
        .replace(/[\s\\{}"<>^|`]/g, (char) => encodeURIComponent(char))
        .replace(/[%#]/g, (char) => `\\${char}`);
}

function href(url: string, labelLatex: string): string {
    return `\\href{${escapeUrl(url)}}{${labelLatex}}`;
}

function link(target: DocumentLink): string {
    return href(target.url, escapeLatex(target.label));
}

function detail(value: DocumentDetail): string {
    const text = value.url ? href(value.url, escapeLatex(value.value)) : escapeLatex(value.value);
    return value.label ? `${escapeLatex(value.label)}: ${text}` : text;
}

function inline(tokens: InlineToken[]): string {
    return tokens
        .map((token) => {
            switch (token.type) {
                case "text":
                    return escapeLatex(token.value);
                case "code":
                    return `\\texttt{${escapeLatex(token.value)}}`;
                case "strong":
                    return `\\textbf{${inline(token.children)}}`;
                case "em":
                    return `\\emph{${inline(token.children)}}`;
                case "link": {
                    const label = inline(token.children);
                    const plain = token.children.map((child) => ("value" in child ? child.value : "")).join("");
                    const safe = toDocumentLink(token.url, plain);
                    return safe ? href(safe.url, label || escapeLatex(safe.label)) : label;
                }
            }
        })
        .join("");
}

/** Rich text (Markdown as authored) as LaTeX paragraphs and lists. */
export function markdownToLatex(markdown: string): string {
    return parseMarkdownBlocks(markdown)
        .map((block) => {
            if (block.type === "paragraph") return inline(block.content);
            const environment = block.ordered ? "enumerate" : "itemize";
            const items = block.items.map((item) => `  \\item ${inline(item)}`).join("\n");
            return `\\begin{${environment}}\n${items}\n\\end{${environment}}`;
        })
        .filter((text) => text.trim())
        .join("\n\n");
}

function bulletList(items: string[]): string {
    const filled = items.map((item) => item.trim()).filter(Boolean);
    if (filled.length === 0) return "";
    return `\\begin{itemize}\n${filled.map((item) => `  \\item ${escapeLatex(item)}`).join("\n")}\n\\end{itemize}`;
}

function line(left: string, right: string, style: "bold" | "italic"): string {
    if (!left && !right) return "";
    const wrap = (text: string) => (text ? (style === "bold" ? `\\textbf{${text}}` : `\\textit{${text}}`) : "");
    return `\\noindent ${wrap(left)}${right ? `\\hfill ${right}` : ""}\\par`;
}

function buildEntry(entry: DocumentEntry): string {
    const title = entry.title.trim();
    const subtitle = entry.subtitle.trim();

    // The entry link belongs to the subtitle, falling back to the title.
    const subtitleLatex = subtitle
        ? entry.link ? href(entry.link.url, escapeLatex(subtitle)) : escapeLatex(subtitle)
        : "";
    const titleLatex = title
        ? !subtitle && entry.link ? href(entry.link.url, escapeLatex(title)) : escapeLatex(title)
        : "";

    const blocks = [
        line(titleLatex, escapeLatex(entry.dateRange), "bold"),
        line(subtitleLatex, escapeLatex(entry.location), "italic"),
        entry.body.trim() ? markdownToLatex(entry.body) : "",
        bulletList(entry.bullets),
        entry.details.length > 0 ? entry.details.map(detail).join(" \\textbullet{} ") : "",
        entry.tags.length > 0 ? entry.tags.map(escapeLatex).join(", ") : "",
    ];

    return `\\medskip\n${blocks.filter(Boolean).join("\n")}`;
}

function buildSection(section: DocumentSection): string {
    const body: string[] = [];

    if (section.text.trim()) body.push(markdownToLatex(section.text));
    if (section.tags.length > 0) body.push(section.tags.map(escapeLatex).join(", "));

    for (const group of section.skillGroups) {
        if (group.skills.length === 0) continue;
        const skills = formatDocumentSkills(group).map(escapeLatex).join(", ");
        body.push(group.name ? `\\textbf{${escapeLatex(group.name)}:} ${skills}` : skills);
    }

    for (const entry of section.entries) body.push(buildEntry(entry));

    // A section that resolved to nothing renders no heading either.
    if (body.length === 0) return "";
    return [`\\section*{${escapeLatex(section.heading)}}`, ...body].join("\n\n");
}

function buildHeader(model: DocumentModel): string {
    const { basics } = model;
    const lines: string[] = [];

    if (basics.name) lines.push(`{\\LARGE\\bfseries ${escapeLatex(basics.name)}}`);
    if (basics.headline) lines.push(escapeLatex(basics.headline));

    const contact = [
        ...basics.emails.map(detail),
        ...(basics.phone ? [escapeLatex(basics.phone)] : []),
        ...(basics.location ? [escapeLatex(basics.location)] : []),
    ];
    if (contact.length > 0) lines.push(contact.join(" \\textbullet{} "));
    if (basics.links.length > 0) lines.push(basics.links.map(link).join(" \\textbullet{} "));
    if (basics.details.length > 0) lines.push(basics.details.map(detail).join(" \\textbullet{} "));

    const blocks: string[] = [];
    if (lines.length > 0) blocks.push(`\\begin{center}\n${lines.join(" \\\\[3pt]\n")}\n\\end{center}`);

    if (basics.summary.trim()) {
        blocks.push(`\\section*{${escapeLatex(basics.summaryHeading)}}\n\n${markdownToLatex(basics.summary)}`);
    }
    return blocks.join("\n\n");
}

/** The language code as a comment-safe token. */
function safeCode(value: string): string {
    return value.replace(/[^A-Za-z0-9-]/g, "").slice(0, 16) || "en";
}

function preamble(model: DocumentModel, paperSize: "a4" | "letter"): string {
    const paper = paperSize === "letter" ? "letterpaper" : "a4paper";
    return [
        "% CV exported from EngineCV.",
        "% This is a standard CV layout, not a copy of the template you chose in EngineCV:",
        "% fonts, colours, columns and the photo are not included. Edit freely.",
        "%",
        "% Compile with XeLaTeX or LuaLaTeX (recommended: any language and script):",
        "%   xelatex cv.tex",
        "% Latin-script CVs also compile with pdfLaTeX. For Cyrillic, Greek or other",
        "% scripts use XeLaTeX or LuaLaTeX and set a font that has them, for example:",
        "%   \\setmainfont{Noto Serif}",
        `% CV language: ${safeCode(model.language)}`,
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
        "\\usepackage[margin=2cm]{geometry}",
        "\\usepackage{enumitem}",
        "\\usepackage{xcolor}",
        "\\usepackage{titlesec}",
        "\\usepackage[colorlinks=true,urlcolor=blue!50!black,linkcolor=blue!50!black]{hyperref}",
        "\\setlength{\\parindent}{0pt}",
        "\\setlength{\\parskip}{3pt}",
        "\\pagestyle{empty}",
        "\\setlist{nosep,leftmargin=1.4em}",
        "\\titleformat{\\section}{\\large\\bfseries\\scshape}{}{0pt}{}[\\titlerule]",
        "\\titlespacing*{\\section}{0pt}{12pt}{6pt}",
    ].join("\n");
}

export function toLatex(model: DocumentModel, options: LatexExportOptions = {}): string {
    const body = [buildHeader(model), ...model.sections.map(buildSection)]
        .map((block) => block.trim())
        .filter(Boolean)
        .join("\n\n");

    return [
        preamble(model, options.paperSize ?? "a4"),
        "",
        "\\begin{document}",
        "",
        body,
        "",
        "\\end{document}",
        "",
    ].join("\n");
}
