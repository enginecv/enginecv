import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { en } from "./en";

// Check shared controls and every interactive app route as well as the editor.
// Editorial/legal prose and resume sample content have their own language.
const ROOTS = ["src/components", "src/app/(site)/dashboard", "src/app/(site)/editor", "src/app/(site)/templates"];
const ATTRIBUTES = new Set(["title", "placeholder", "aria-label", "alt", "label", "description", "tooltip", "addLabel", "confirmLabel"]);
const UNITS = /^(px|pt|em|deg|%|Aa|AA|aa|aA)$/;
const BRANDS_AND_KEYS = new Set(["EngineCV", "EngineCV.", "Esc"]);

// "file: text" pairs that are not translatable UI copy.
const ALLOWED = new Set([
    "src/app/(site)/dashboard/page.tsx: EngineCV",
    "src/components/editor/CommandPalette.tsx: Esc",
    // Chrome flag names the user has to find in chrome://flags verbatim.
    "src/components/editor/AIChat.tsx: Enabled",
    "src/components/editor/AIChat.tsx: Enabled BypassPerfRequirement",
    "src/components/editor/AIChat.tsx: Optimization Guide On Device Model",
    "src/components/editor/AIChat.tsx: Check for update",
    "src/components/editor/CustomizeSidebar.tsx: https://fonts.googleapis.com/css2?family=...",
    "src/components/editor/EditorSidebar.tsx: linkedin.com/in/username",
    "src/components/editor/EditorSidebar.tsx: example.com",
    // Alt text inside the resume document, which follows the CV language.
    "src/components/editor/ResumePreview.tsx: Signature",
    // Illustrative files and database names in the landing-page diagrams.
    "src/components/landing/NoLockInSection.tsx: resume-john-doe.json",
    "src/components/landing/ProductStory.tsx: EngineCVDatabase",
    "src/components/landing/ProductStory.tsx: resume.json",
    "src/components/landing/ProductStory.tsx: 24.8 KB",
    "src/components/landing/ProductStory.tsx: history/07",
    "src/components/landing/ProductStory.tsx: john-doe-resume",
    "src/components/landing/SupportSection.tsx: Safet",
    // Sample resume content, not interface labels.
    "src/components/templates/TemplatePreviewCard.tsx: John Doe",
    "src/components/templates/TemplatePreviewCard.tsx: Senior Product Designer",
    "src/components/templates/TemplatePreviewCard.tsx: Experience",
    "src/components/templates/TemplatePreviewCard.tsx: Education",
    "src/components/templates/TemplatePreviewCard.tsx: Projects",
    "src/components/templates/TemplatePreviewCard.tsx: Skills",
    "src/components/landing/BYOAISection.tsx: Ollama",
    // Literal fragments of example URLs, not interface instructions.
    "src/components/editor/EditorSidebar.tsx: .com/username",
    "src/components/import/OrganizationPicker.tsx: github.com/",
]);

function listTsxFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return listTsxFiles(full);
        return full.endsWith(".tsx") && !full.includes(".test.") ? [full] : [];
    });
}

function hasWords(text: string) {
    const decoded = text.replace(/&(?:#\d+|#x[\da-f]+|[a-z]+);/gi, "");
    return /[A-Za-z]{2,}/.test(decoded) && /[a-z]/.test(decoded);
}

function isStringLiteral(node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
    return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function literalUiText(node: ts.Node): string | null {
    if (isStringLiteral(node)) return node.text;
    if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((span) => span.literal.text).join("");
    return null;
}

// A string that a `?:`, `&&`, `||` or `??` puts straight into JSX children or
// one of ATTRIBUTES: {open && "New Resume"}, title={collapsed ? "New" : undefined}.
function isConditionalUiOperand(node: ts.Node): boolean {
    let child = node;
    let parent = node.parent;
    while (parent && (ts.isConditionalExpression(parent) || ts.isBinaryExpression(parent) || ts.isParenthesizedExpression(parent))) {
        if (ts.isConditionalExpression(parent)) {
            if (parent.condition === child) return false;
        } else if (ts.isBinaryExpression(parent)) {
            const op = parent.operatorToken.kind;
            if (op !== ts.SyntaxKind.AmpersandAmpersandToken && op !== ts.SyntaxKind.BarBarToken && op !== ts.SyntaxKind.QuestionQuestionToken) return false;
            if (op === ts.SyntaxKind.AmpersandAmpersandToken && parent.left === child) return false;
        }
        child = parent;
        parent = parent.parent;
    }
    if (!parent || !ts.isJsxExpression(parent)) return false;
    const owner = parent.parent;
    if (ts.isJsxElement(owner) && ["style", "script"].includes(owner.openingElement.tagName.getText())) return false;
    return ts.isJsxElement(owner) || ts.isJsxFragment(owner)
        || (ts.isJsxAttribute(owner) && ATTRIBUTES.has(owner.name.getText()));
}

function findHardcodedStrings(file: string): string[] {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const found: string[] = [];
    const visit = (node: ts.Node) => {
        let text: string | null = null;
        // English can hide in link/option configuration rather than JSX.
        if (ts.isPropertyAssignment(node) && ATTRIBUTES.has(node.name.getText()) && literalUiText(node.initializer)) {
            const hasLabelKey = ts.isObjectLiteralExpression(node.parent)
                && node.parent.properties.some((property) => ts.isPropertyAssignment(property) && property.name.getText() === "labelKey");
            let owner: ts.Node | undefined = node;
            while (owner && !ts.isVariableDeclaration(owner)) owner = owner.parent;
            // App routes follow stored preferences, while their server metadata
            // has a fixed fallback language. Metadata localization is separate.
            const metadata = owner && ts.isVariableDeclaration(owner) && owner.name.getText() === "metadata";
            const iconChoices = owner && ts.isVariableDeclaration(owner)
                && ["COMMON_ICON_CHOICES", "OTHER_ICON_CHOICES"].includes(owner.name.getText());
            // These icon labels are localized at display time; gui-options tests
            // require dictionaries for every non-brand choice.
            if (!hasLabelKey && !iconChoices && !metadata) text = literalUiText(node.initializer);
        }
        if (ts.isJsxText(node)) {
            text = node.text.trim();
        } else if (ts.isJsxAttribute(node) && ATTRIBUTES.has(node.name.getText()) && node.initializer) {
            const init = node.initializer;
            if (ts.isStringLiteral(init)) text = init.text;
            else if (ts.isJsxExpression(init) && init.expression) {
                text = literalUiText(init.expression);
            }
        } else if ((isStringLiteral(node) || ts.isTemplateExpression(node)) && isConditionalUiOperand(node)) {
            text = literalUiText(node);
        }
        if (text && hasWords(text) && !UNITS.test(text) && !BRANDS_AND_KEYS.has(text)
            && !/^(?:(?:px|pt|em|deg|x)|[\s•×%])+$/.test(text)
            && !(text in en) && !/^[DMYHhmdos:/., -]+$/.test(text) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) {
            const entry = `${file.split(path.sep).join("/")}: ${text}`;
            if (!ALLOWED.has(entry)) {
                const { line } = source.getLineAndCharacterOfPosition(node.getStart());
                found.push(`${file}:${line + 1}: ${text}`);
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(source);
    return found;
}

describe("hardcoded UI strings", () => {
    it("localizes interface text across app routes and shared components", () => {
        const found = ROOTS.flatMap(listTsxFiles).flatMap(findHardcodedStrings);
        expect(found).toEqual([]);
    });

    it("defines every statically referenced interface translation key", () => {
        const missing: string[] = [];
        for (const file of ROOTS.flatMap(listTsxFiles)) {
            const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
            const visit = (node: ts.Node) => {
                if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
                    && ["t", "tn"].includes(node.expression.text)) {
                    const argument = node.arguments[0];
                    if (argument && ts.isStringLiteral(argument) && !(argument.text in en) && !(`${argument.text}.one` in en)) {
                        missing.push(`${file}: ${argument.text}`);
                    }
                }
                ts.forEachChild(node, visit);
            };
            visit(source);
        }
        expect(missing).toEqual([]);
    });
});
