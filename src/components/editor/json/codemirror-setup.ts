import { EditorState, StateField, type Extension } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, hoverTooltip, keymap, lineNumbers } from "@codemirror/view";
import { autocompletion, completionKeymap, type CompletionSource } from "@codemirror/autocomplete";
import { lintGutter, lintKeymap } from "@codemirror/lint";
import { parseTree, findNodeAtLocation, findNodeAtOffset } from "jsonc-parser";
import { pathAtOffset } from "@/lib/json-edit/locate";
import { buildResumeJsonSchema, completionsAt, describeType, schemaAt, type TypeDescriptor } from "@/lib/json-edit/schema-help";
import type { Problem } from "@/lib/json-edit/problems";
import { bracketMatching, HighlightStyle, foldEffect, unfoldEffect, foldGutter, foldKeymap, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { Decoration, WidgetType, type DecorationSet } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { search, searchKeymap } from "@codemirror/search";
import { json } from "@codemirror/lang-json";

class HiddenId extends WidgetType {
    constructor(readonly label: string) { super(); }
    eq(other: HiddenId) { return other.label === this.label; }
    toDOM() { const span = document.createElement("span"); span.className = "json-internal-id text-faint"; span.textContent = "·"; span.setAttribute("aria-label", this.label); return span; }
}
export function hiddenInternalFields(label: string): Extension {
    const decorate = (state: EditorState) => {
        const ranges: ReturnType<Decoration["range"]>[] = [];
        const walk = (node: ReturnType<typeof parseTree>) => {
            if (!node) return;
            if (node.type === "property" && node.children?.[0]?.value === "id" && node.children[1]?.type === "string") {
                ranges.push(Decoration.replace({ widget: new HiddenId(label) }).range(node.offset, node.offset + node.length));
                return;
            }
            node.children?.forEach(walk);
        };
        walk(parseTree(state.doc.toString()));
        return Decoration.set(ranges, true);
    };
    const field = StateField.define<DecorationSet>({ create: decorate, update: (value, transaction) => transaction.docChanged ? decorate(transaction.state) : value,
        provide: field => EditorView.decorations.from(field),
    });
    return [field, EditorView.atomicRanges.of(view => view.state.field(field))];
}
export function foldInternalFields(view: EditorView, hidden: boolean) {
    const root = parseTree(view.state.doc.toString());
    const ranges = [["aiHistory"], ["customization"], ["settings"], ["basics", "photoEdit"]].flatMap(path => {
        const node = root && findNodeAtLocation(root, path);
        return node && node.length > 2 && ["object", "array"].includes(node.type)
            ? [{ from: node.offset + 1, to: node.offset + node.length - 1 }] : [];
    }).sort((a, b) => a.from - b.from);
    const effects = ranges.map(range => (hidden ? foldEffect : unfoldEffect).of(range));
    if (effects.length) view.dispatch({ effects });
}

const theme = EditorView.theme({
    "&": { height: "100%", color: "var(--color-strong)", backgroundColor: "var(--color-surface-1)" },
    ".cm-scroller": { overflow: "auto", fontFamily: "var(--font-geist-mono), monospace", fontSize: "12px" },
    ".cm-content": { minHeight: "160px" },
    ".cm-gutters": { backgroundColor: "var(--color-surface-2)", color: "var(--color-faint)", borderColor: "var(--color-edge)" },
    ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--color-edge)" },
    "&.cm-focused": { outline: "2px solid var(--color-accent)", outlineOffset: "-2px" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "color-mix(in srgb, var(--color-accent) 25%, transparent)" },
    ".cm-cursor": { borderLeftColor: "var(--color-strong)" },
    ".cm-foldPlaceholder": { color: "var(--color-strong)", backgroundColor: "var(--color-surface-3)", borderColor: "var(--color-edge)" },
    ".cm-tooltip, .cm-panels": { backgroundColor: "var(--color-surface-2)", color: "var(--color-strong)", borderColor: "var(--color-edge)" },
    ".cm-tooltip-autocomplete ul li[aria-selected]": { backgroundColor: "var(--color-edge)", color: "var(--color-strong)" },
});
const jsonHighlightStyle = HighlightStyle.define([
    { tag: tags.propertyName, color: "var(--color-accent)" },
    { tag: tags.string, color: "var(--color-strong)" },
    { tag: [tags.number, tags.bool, tags.null], color: "var(--color-accent)" },
    { tag: [tags.punctuation, tags.comment], color: "var(--color-mid)" },
    { tag: tags.invalid, color: "var(--color-danger)" },
]);

export type Translate = (key: string, params?: Record<string, string | number>) => string;
export function typeText(type: TypeDescriptor, t: Translate): string {
    if (type.kind === "enum") return type.values.map(value => JSON.stringify(value)).join(" | ");
    if (type.kind === "array") return t("jsonEditor.type.array", { item: typeText(type.item, t) });
    return t(`jsonEditor.type.${type.kind}`);
}
export function problemMessage(problem: Problem, t: Translate): string {
    const expected = problem.params.expected;
    const params = { ...problem.params, ...(expected && ["string", "number", "boolean", "object", "array", "integer", "null"].includes(expected) ? { expected: t(`jsonEditor.type.${expected === "array" ? "list" : expected}`) } : {}) };
    return `${problem.path}: ${t(`jsonEditor.problem.${problem.code}`, params)}`;
}

export function resumeCompletionSource(t: Translate): CompletionSource {
    const schema = buildResumeJsonSchema();
    return context => {
        const text = context.state.doc.toString();
        const location = pathAtOffset(text, context.pos);
        const tree = parseTree(text);
        const path = location.isKey ? location.path.slice(0, -1) : location.path;
        const parent = tree && findNodeAtLocation(tree, path);
        const present = location.isKey ? (parent?.children ?? []).map(child => child.children?.[0]?.value).filter(key => typeof key === "string" && key !== location.path.at(-1)) : [];
        const options = completionsAt(schema, path, present);
        if (!options.length) return null;
        const token = tree && findNodeAtOffset(tree, context.pos);
        const word = context.matchBefore(/[\w-]*/);
        const quoted = token?.type === "string" && context.pos >= token.offset && context.pos <= token.offset + token.length;
        const from = quoted ? token.offset : word?.from ?? context.pos;
        const to = quoted ? token.offset + token.length : context.pos;
        const colonPresent = location.isKey && /^\s*:/.test(text.slice(to));
        const prefix = text.slice(from, context.pos).replace(/^"|"$/g, "");
        // Replacement includes quotes; filter their contents rather than asking
        // CodeMirror to match the opening quote against an unquoted field name.
        return { from, to, filter: false, options: options.filter(option => option.key.replace(/^"|"$/g, "").startsWith(prefix)).map(option => ({
            label: option.key,
            type: location.isKey ? "property" : "enum",
            detail: t(`jsonEditor.type.${option.type === "array" ? "list" : option.type}`),
            info: typeText(describeType(schemaAt(schema, location.isKey ? [...path, option.key] : path) ?? {}), t),
            apply: location.isKey ? `${JSON.stringify(option.key)}${colonPresent ? "" : ": "}` : option.key,
        })) };
    };
}

export function schemaGuidance(t: Translate): Extension {
    const schema = buildResumeJsonSchema();
    const phrases = ["Find", "Replace", "next", "previous", "all", "match case", "regexp", "by word", "replace", "replace all", "close", "Go to line", "go", "current match", "on line", "Fold line", "Unfold line", "folded code", "unfold", "Folded lines", "Unfolded lines", "to", "Completions", "Diagnostics", "No diagnostics", "replaced match on line $", "replaced $ matches"];
    return [EditorState.phrases.of(Object.fromEntries(phrases.map(phrase => [phrase, t(`jsonEditor.cm.${phrase}`)]))), lintGutter(), keymap.of([...completionKeymap, ...lintKeymap]),
        autocompletion({ override: [resumeCompletionSource(t)] }),
        hoverTooltip((view, pos) => {
            const text = view.state.doc.toString();
            const location = pathAtOffset(text, pos);
            if (!location.isKey) return null;
            const node = schemaAt(schema, location.path);
            const tree = parseTree(text);
            const token = tree && findNodeAtOffset(tree, pos);
            if (!node || token?.type !== "string") return null;
            const description = location.path.length === 1 ? t(`jsonEditor.section.${location.path[0]}`) : "";
            return { pos: token.offset, end: token.offset + token.length, above: true, create: () => {
                const dom = document.createElement("div"); dom.className = "max-w-xs p-2 text-xs";
                dom.textContent = [description, typeText(describeType(node), t)].filter(Boolean).join(" — ");
                return { dom };
            } };
        }),
    ];
}

export function createJsonEditor(parent: HTMLElement, text: string, label: string, onChange: (text: string) => void, extensions: Extension[] = []): EditorView {
    const view = new EditorView({ parent, state: EditorState.create({ doc: text, extensions: [
        json(), lineNumbers(), foldGutter(), bracketMatching(), indentOnInput(), drawSelection(),
        highlightActiveLine(), highlightActiveLineGutter(), syntaxHighlighting(jsonHighlightStyle), history(), search(), theme,
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...foldKeymap, ...searchKeymap]),
        EditorView.contentAttributes.of({ "aria-label": label }),
        EditorView.updateListener.of(update => { if (update.docChanged) onChange(update.state.doc.toString()); }),
        ...extensions,
    ] }) });
    view.scrollDOM.tabIndex = 0;
    return view;
}
