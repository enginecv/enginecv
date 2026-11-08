"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { Bold, Italic, Underline as UnderlineIcon, Minus, Plus } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

/* -------------------------------------------------------------------------- */
/* Contexts                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Positional interactivity. The preview renders every block twice (visible +
 * hidden measure pass, sharing the same element objects). The measure subtree
 * sets this `false` so its copies render static, stay unfocusable, and never
 * register into the navigation registry.
 */
export const InlineInteractiveContext = createContext(false);

type FieldMode = "rich" | "plain";

/**
 * Optional global-style controls a field exposes to the floating toolbar.
 * Values read from, and writes go to, the resume's global settings (per the
 * class-wide global-binding model), so e.g. resizing one job title resizes all.
 */
export interface StyleTarget {
    size?: {
        value: number;
        min: number;
        max: number;
        step?: number;
        unit?: string;
        set: (next: number) => void;
    };
}

interface FieldApi {
    el: HTMLElement;
    enterEdit: () => void;
}

interface InlineEditContextValue {
    activeEditor: Editor | null;
    setActiveEditor: (editor: Editor | null) => void;
    activeStyle: StyleTarget | null;
    setActiveStyle: (style: StyleTarget | null) => void;
    register: (api: FieldApi) => void;
    unregister: (el: HTMLElement) => void;
    /** Directional navigation between focusable field boxes (arrows / hjkl). */
    focusDirection: (fromEl: HTMLElement, dir: "up" | "down" | "left" | "right") => void;
    /** Jump to the first / last field box in document order. */
    focusEdge: (which: "first" | "last") => void;
    /** Tab navigation: commit current, enter edit on the DOM-order neighbour. */
    editAdjacent: (fromEl: HTMLElement, forward: boolean) => void;
}

const InlineEditContext = createContext<InlineEditContextValue | null>(null);

function useInlineEdit() {
    return useContext(InlineEditContext);
}

/* -------------------------------------------------------------------------- */
/* Provider + shared toolbar                                                   */
/* -------------------------------------------------------------------------- */

export function InlineEditProvider({ children }: { children: ReactNode }) {
    const [activeEditor, setActiveEditor] = useState<Editor | null>(null);
    const [activeStyle, setActiveStyle] = useState<StyleTarget | null>(null);
    const fields = useRef<Set<FieldApi>>(new Set());

    const register = useCallback((api: FieldApi) => {
        fields.current.add(api);
    }, []);

    const unregister = useCallback((el: HTMLElement) => {
        for (const api of fields.current) {
            if (api.el === el) {
                fields.current.delete(api);
                break;
            }
        }
    }, []);

    // DOM-order sorted list of live field apis.
    const ordered = useCallback(() => {
        return Array.from(fields.current)
            .filter((a) => a.el.isConnected)
            .sort((a, b) =>
                a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
            );
    }, []);

    const editAdjacent = useCallback((fromEl: HTMLElement, forward: boolean) => {
        const list = ordered();
        const idx = list.findIndex((a) => a.el === fromEl);
        if (idx < 0) return;
        const next = list[idx + (forward ? 1 : -1)];
        if (next) next.enterEdit();
    }, [ordered]);

    const focusDirection = useCallback((fromEl: HTMLElement, dir: "up" | "down" | "left" | "right") => {
        const s = fromEl.getBoundingClientRect();
        const sx = s.left + s.width / 2;
        const sy = s.top + s.height / 2;
        const vertical = dir === "up" || dir === "down";

        let best: { el: HTMLElement; score: number } | null = null;
        for (const api of fields.current) {
            if (api.el === fromEl || !api.el.isConnected) continue;
            const r = api.el.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;

            // Must be on the correct side along the movement axis (by centre).
            if (dir === "up" && cy >= sy - 1) continue;
            if (dir === "down" && cy <= sy + 1) continue;
            if (dir === "left" && cx >= sx - 1) continue;
            if (dir === "right" && cx <= sx + 1) continue;

            // Primary = nearest-edge gap along the movement axis.
            // Perpendicular overlap on the OTHER axis means the fields line up
            // (same column for up/down, same row for left/right) regardless of
            // differing widths/heights — the key to intuitive movement.
            let primary: number, overlap: number, perpOffset: number;
            if (dir === "down") { primary = Math.max(0, r.top - s.bottom); }
            else if (dir === "up") { primary = Math.max(0, s.top - r.bottom); }
            else if (dir === "right") { primary = Math.max(0, r.left - s.right); }
            else { primary = Math.max(0, s.left - r.right); }

            if (vertical) {
                overlap = Math.min(s.right, r.right) - Math.max(s.left, r.left);
                perpOffset = Math.abs(cx - sx);
            } else {
                overlap = Math.min(s.bottom, r.bottom) - Math.max(s.top, r.top);
                perpOffset = Math.abs(cy - sy);
            }

            // Aligned (overlapping) fields win outright, ranked by axis gap;
            // non-aligned only when nothing lines up, then by combined distance.
            const score = overlap > 0
                ? primary + perpOffset * 0.001
                : 1e6 + primary + perpOffset;

            if (!best || score < best.score) best = { el: api.el, score };
        }
        if (best) best.el.focus();
    }, []);

    const focusEdge = useCallback((which: "first" | "last") => {
        const list = ordered();
        const target = which === "first" ? list[0] : list[list.length - 1];
        target?.el.focus();
    }, [ordered]);

    const value = useMemo<InlineEditContextValue>(() => ({
        activeEditor,
        setActiveEditor,
        activeStyle,
        setActiveStyle,
        register,
        unregister,
        focusDirection,
        focusEdge,
        editAdjacent,
    }), [activeEditor, activeStyle, register, unregister, focusDirection, focusEdge, editAdjacent]);

    return <InlineEditContext.Provider value={value}>{children}</InlineEditContext.Provider>;
}

const toolbarBtn =
    "flex h-7 w-7 items-center justify-center rounded-md text-strong transition-colors disabled:opacity-30 disabled:cursor-default hover:bg-edge";

/**
 * Floating formatting toolbar. Appears just above (or below, near the top of
 * the page) the field currently being edited and follows it as the user types
 * or scrolls; disappears when no field is active. Portalled to <body> so it
 * escapes the zoomed/panned/overflow-clipped preview. Drives the shared
 * `activeEditor`; buttons auto-disable when the field doesn't support the mark
 * (e.g. single-line plain fields).
 */
export function InlineToolbar() {
    const { t } = useTranslation();
    const ctx = useInlineEdit();
    const editor = ctx?.activeEditor ?? null;
    const style = ctx?.activeStyle ?? null;
    // `owner` tags the measurement with the editor it was taken for, so a stale
    // position from the previous field is never painted at the new one (and the
    // effect never has to null it out on teardown).
    const [pos, setPos] = useState<{ top: number; left: number; owner: unknown } | null>(null);

    useEffect(() => {
        if (!editor) return;
        const dom = editor.view.dom as HTMLElement;
        const GAP = 8;
        const TOOLBAR_H = 38;
        const update = () => {
            const r = dom.getBoundingClientRect();
            let top = r.top - GAP - TOOLBAR_H;
            if (top < 8) top = r.bottom + GAP; // flip below when near the top
            const left = Math.min(Math.max(r.left + r.width / 2, 70), window.innerWidth - 70);
            setPos({ top, left, owner: editor });
        };
        update();
        editor.on("transaction", update);
        window.addEventListener("scroll", update, true);
        window.addEventListener("resize", update);
        return () => {
            editor.off("transaction", update);
            window.removeEventListener("scroll", update, true);
            window.removeEventListener("resize", update);
        };
    }, [editor]);

    if (!editor || !pos || pos.owner !== editor || typeof document === "undefined") return null;

    // Plain-mode fields disable the mark extensions, so their toggle commands
    // aren't registered — probe the commands map rather than editor.can(),
    // which would throw on the missing command.
    const commands = editor.commands as unknown as Record<string, unknown>;
    const hasCmd = (name: string) => typeof commands[name] === "function";
    const hasMarks = hasCmd("toggleBold") || hasCmd("toggleItalic") || hasCmd("toggleUnderline");
    const size = style?.size;

    // Nothing to offer (plain field with no style target) — skip the toolbar.
    if (!hasMarks && !size) return null;

    const mk = (
        label: string,
        Icon: typeof Bold,
        markName: string,
        command: string,
    ) => {
        const can = hasCmd(command);
        return (
            <button
                type="button"
                aria-label={label}
                disabled={!can}
                className={`${toolbarBtn} ${editor.isActive(markName) ? "bg-edge text-accent" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                    if (!can) return;
                    (editor.chain().focus() as unknown as Record<string, () => { run: () => void }>)[command]().run();
                }}
            >
                <Icon className="h-4 w-4" />
            </button>
        );
    };

    const stepSize = (delta: number) => {
        if (!size) return;
        const step = size.step ?? 1;
        const next = Math.min(size.max, Math.max(size.min, size.value + delta * step));
        if (next !== size.value) size.set(next);
    };

    return createPortal(
        <div
            className="fixed z-[140] flex items-center gap-1 rounded-lg border border-edge bg-surface-1 p-1 shadow-xl"
            style={{ top: pos.top, left: pos.left, transform: "translateX(-50%)" }}
            data-no-drag
        >
            {hasMarks && (
                <>
                    {mk("Bold (Ctrl+B)", Bold, "bold", "toggleBold")}
                    {mk("Italic (Ctrl+I)", Italic, "italic", "toggleItalic")}
                    {mk("Underline (Ctrl+U)", UnderlineIcon, "underline", "toggleUnderline")}
                </>
            )}
            {hasMarks && size && <span className="mx-0.5 h-5 w-px bg-edge" />}
            {size && (
                <>
                    <button type="button" aria-label={t("inlineEdit.decreaseSize")} className={toolbarBtn} onMouseDown={(e) => e.preventDefault()} onClick={() => stepSize(-1)}>
                        <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-[2.25rem] text-center text-xs tabular-nums text-strong">
                        {size.value}{size.unit ?? ""}
                    </span>
                    <button type="button" aria-label={t("inlineEdit.increaseSize")} className={toolbarBtn} onMouseDown={(e) => e.preventDefault()} onClick={() => stepSize(1)}>
                        <Plus className="h-4 w-4" />
                    </button>
                </>
            )}
        </div>,
        document.body,
    );
}

/* -------------------------------------------------------------------------- */
/* Field                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A unified inline-editable field. `mode="rich"` allows markdown marks (bold /
 * italic / underline, serialised back to markdown); `mode="plain"` is a
 * single-line text field with no marks (serialised to plain text). The outer
 * wrapper stays mounted across the view/edit toggle so it remains focusable and
 * registry-stable for keyboard navigation.
 */
export function InlineField({
    value,
    onCommit,
    mode = "plain",
    as = "div",
    className,
    editClassName,
    staticRender,
    styleTarget,
    dataAttrs,
}: {
    value: string;
    onCommit: (value: string) => void;
    mode?: FieldMode;
    as?: keyof React.JSX.IntrinsicElements;
    className?: string;
    editClassName?: string;
    staticRender?: ReactNode;
    styleTarget?: StyleTarget;
    /** Extra attributes on the wrapper (test ids, data-nav-* click targets). */
    dataAttrs?: Record<string, string>;
}) {
    const interactive = useContext(InlineInteractiveContext);
    const ctx = useInlineEdit();
    const [editing, setEditing] = useState(false);
    const wrapperRef = useRef<HTMLElement>(null);
    const returnFocus = useRef(false);

    const enterEdit = useCallback(() => {
        if (interactive) setEditing(true);
    }, [interactive]);

    // Register with the nav registry while interactive.
    useEffect(() => {
        if (!interactive || !ctx) return;
        const el = wrapperRef.current;
        if (!el) return;
        const api: FieldApi = { el, enterEdit };
        ctx.register(api);
        return () => ctx.unregister(el);
    }, [interactive, ctx, enterEdit]);

    // After leaving edit mode by commit/cancel, return focus to the box.
    useEffect(() => {
        if (!editing && returnFocus.current) {
            returnFocus.current = false;
            wrapperRef.current?.focus();
        }
    }, [editing]);

    const Wrapper = as as React.ElementType;
    const refCb = (node: HTMLElement | null) => { wrapperRef.current = node; };
    const staticContent = staticRender ?? (value || null);

    if (!interactive) {
        // Exports / thumbnails: never emit the placeholder for an empty field.
        const content = staticRender ?? (value || null);
        if (content == null) return null;
        return <Wrapper className={className} {...dataAttrs}>{content}</Wrapper>;
    }

    // Missing resume content stays absent from the preview. Users can still add
    // it from the content panel; the canvas must not invent visible placeholders.
    if (!editing && staticContent == null) return null;

    if (!editing) {
        return (
            <Wrapper
                ref={refCb}
                data-editable-field
                tabIndex={0}
                {...dataAttrs}
                className={`inline-edit-box ${className ?? ""}`}
                onDoubleClick={(e: React.MouseEvent) => { e.stopPropagation(); enterEdit(); }}
                onKeyDown={(e: React.KeyboardEvent) => {
                    const k = e.key;
                    // Enter edit: Enter / F2 / vim insert (i, a).
                    if (k === "Enter" || k === "F2" || k === "i" || k === "a") {
                        e.preventDefault();
                        enterEdit();
                        return;
                    }
                    // Directional nav: arrows + vim hjkl.
                    const dir =
                        k === "ArrowUp" || k === "k" ? "up" :
                        k === "ArrowDown" || k === "j" ? "down" :
                        k === "ArrowLeft" || k === "h" ? "left" :
                        k === "ArrowRight" || k === "l" ? "right" : null;
                    if (dir) {
                        e.preventDefault();
                        ctx?.focusDirection(e.currentTarget as HTMLElement, dir);
                        return;
                    }
                    // vim edges: G last, g first.
                    if (k === "G") { e.preventDefault(); ctx?.focusEdge("last"); }
                    else if (k === "g") { e.preventDefault(); ctx?.focusEdge("first"); }
                }}
            >
                {staticContent}
            </Wrapper>
        );
    }

    return (
        <Wrapper
            ref={refCb}
            data-editable-field
            data-editing="true"
            tabIndex={-1}
            {...dataAttrs}
            className={`inline-edit-box is-editing ${editClassName ?? className ?? ""}`}
        >
            <FieldEditor
                mode={mode}
                value={value}
                styleTarget={styleTarget}
                onCommit={(v) => { returnFocus.current = true; onCommit(v); setEditing(false); }}
                onCancel={() => { returnFocus.current = true; setEditing(false); }}
                onTab={(forward) => {
                    const el = wrapperRef.current;
                    setEditing(false);
                    if (el) ctx?.editAdjacent(el, forward);
                }}
            />
        </Wrapper>
    );
}

/* -------------------------------------------------------------------------- */
/* Editor                                                                      */
/* -------------------------------------------------------------------------- */

const PLAIN_DISABLED = {
    bold: false as const,
    italic: false as const,
    strike: false as const,
    code: false as const,
    underline: false as const,
    heading: false as const,
    bulletList: false as const,
    orderedList: false as const,
    listItem: false as const,
    blockquote: false as const,
    codeBlock: false as const,
    horizontalRule: false as const,
    link: false as const,
};

function FieldEditor({
    mode,
    value,
    styleTarget,
    onCommit,
    onCancel,
    onTab,
}: {
    mode: FieldMode;
    value: string;
    styleTarget?: StyleTarget;
    onCommit: (value: string) => void;
    onCancel: () => void;
    onTab: (forward: boolean) => void;
}) {
    const ctx = useInlineEdit();
    const committed = useRef(false);

    const editor = useEditor({
        immediatelyRender: false,
        extensions:
            mode === "rich"
                ? [StarterKit, Markdown.configure({ html: false })]
                : [StarterKit.configure(PLAIN_DISABLED)],
        content: value,
        autofocus: "end",
        editorProps: {
            attributes: { class: "outline-none" },
        },
    });

    const serialize = useCallback(() => {
        if (!editor) return value;
        if (mode === "rich") {
            const storage = editor.storage as unknown as Record<string, { getMarkdown: () => string }>;
            return storage.markdown.getMarkdown();
        }
        return editor.getText().replace(/\s+/g, " ").trim();
    }, [editor, mode, value]);

    const commit = useCallback(() => {
        if (committed.current) return;
        committed.current = true;
        onCommit(serialize());
    }, [onCommit, serialize]);

    // Register/unregister as the toolbar's active editor.
    useEffect(() => {
        if (!editor || !ctx) return;
        ctx.setActiveEditor(editor);
        return () => ctx.setActiveEditor(null);
    }, [editor, ctx]);

    // Keep the toolbar's style target in sync (re-runs when the value changes,
    // e.g. after the size stepper writes back to global settings).
    useEffect(() => {
        if (!editor || !ctx) return;
        ctx.setActiveStyle(styleTarget ?? null);
        return () => ctx.setActiveStyle(null);
    }, [editor, ctx, styleTarget]);

    if (!editor) return null;

    return (
            <EditorContent
                editor={editor}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === "Escape") {
                        e.preventDefault();
                        committed.current = true; // suppress the blur commit
                        onCancel();
                    } else if (e.key === "Tab") {
                        e.preventDefault();
                        commit();
                        onTab(!e.shiftKey);
                    } else if (e.key === "Enter" && (mode === "plain" || e.metaKey || e.ctrlKey)) {
                        // plain: Enter commits. rich: Ctrl/Cmd+Enter commits.
                        // commit() -> onCommit leaves edit mode and returns focus.
                        e.preventDefault();
                        commit();
                    }
                }}
            />
    );
}
