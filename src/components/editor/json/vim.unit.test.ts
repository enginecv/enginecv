import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { createQaMinimalResume } from "@/lib/qa/sample-resumes";
import { serializeForEditing } from "@/lib/json-edit/serialize";
import { loadVim } from "./vim";

let view: EditorView | undefined;
afterEach(() => { view?.destroy(); document.body.replaceChildren(); });
describe("Vim command and Escape precedence", () => {
    it("returns to Normal from visual/insert and routes ex commands to this view", async () => {
        Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [] });
        Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => new DOMRect() });
        const actions = { apply: vi.fn(), close: vi.fn(), mode: vi.fn(), commandLabel: () => "Vim command", focusStolen: vi.fn() };
        const loaded = await loadVim(actions);
        view = new EditorView({ parent: document.body, state: EditorState.create({ doc: serializeForEditing(createQaMinimalResume()).text, extensions: [keymap.of(defaultKeymap), loaded.extension] }) });
        const detach = loaded.attach(view);
        const { Vim, getCM } = await import("@replit/codemirror-vim");
        // The installed Vim extension has initialised this adapter's Vim state.
        const cm = getCM(view)! as Parameters<typeof Vim.handleEx>[0];
        view.focus();
        const outerEscape = vi.fn();
        document.addEventListener("keydown", outerEscape);
        for (const key of ["v", "i"]) {
            Vim.handleKey(cm, key, "test");
            const escape = new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true });
            view.contentDOM.dispatchEvent(escape);
            expect(actions.mode).toHaveBeenLastCalledWith("normal");
            expect(escape.defaultPrevented).toBe(true);
            expect(view.hasFocus).toBe(true);
        }
        view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
        expect(view.hasFocus).toBe(true);
        expect(outerEscape).not.toHaveBeenCalled();
        document.removeEventListener("keydown", outerEscape);
        Vim.handleEx(cm, "w"); expect(actions.apply).toHaveBeenLastCalledWith(false);
        Vim.handleEx(cm, "wq"); expect(actions.apply).toHaveBeenLastCalledWith(true);
        Vim.handleEx(cm, "q"); expect(actions.close).toHaveBeenCalledOnce();
        detach();
    });

    it("reports an orphan blur (no key or click reached the page) as stolen focus", async () => {
        const focusStolen = vi.fn();
        const loaded = await loadVim({ apply: vi.fn(), close: vi.fn(), mode: vi.fn(), commandLabel: () => "Vim command", focusStolen });
        view = new EditorView({ parent: document.body, state: EditorState.create({ doc: "{}", extensions: [loaded.extension] }) });
        const detach = loaded.attach(view);
        vi.spyOn(document, "hasFocus").mockReturnValue(true);
        const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
        try {
            // Escape swallowed by an extension: only the blur reaches the page.
            view.focus(); await new Promise(resolve => setTimeout(resolve, 200));
            view.contentDOM.blur(); await frame();
            expect(focusStolen).toHaveBeenCalledOnce();
            // A page-visible key or click explains the blur, so no hint.
            view.focus(); window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
            view.contentDOM.blur(); await frame();
            view.focus(); window.dispatchEvent(new Event("pointerdown"));
            view.contentDOM.blur(); await frame();
            expect(focusStolen).toHaveBeenCalledOnce();
        } finally { detach(); }
    });
});
