import { Prec, type Extension } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";

export type VimMode = "normal" | "insert" | "visual" | "replace";
export interface VimActions {
    apply: (closeAfter: boolean) => void;
    close: () => void;
    mode: (mode: VimMode) => void;
    commandLabel: () => string;
    /** Focus left for <body> with no key or click reaching the page (e.g. Vimium's Esc). */
    focusStolen: () => void;
}
const actionsByView = new WeakMap<EditorView, VimActions>();
let registered = false;

/** This module and the package are both absent until Vim is enabled. */
export async function loadVim(actions: VimActions): Promise<{ extension: Extension; attach: (view: EditorView) => () => void }> {
    const { vim, Vim, getCM } = await import("@replit/codemirror-vim");
    if (!registered) {
        Vim.defineEx("write", "w", cm => actionsByView.get(cm.cm6)?.apply(false));
        Vim.defineEx("quit", "q", cm => actionsByView.get(cm.cm6)?.close());
        Vim.defineEx("wq", "wq", cm => actionsByView.get(cm.cm6)?.apply(true));
        registered = true;
    }
    return { extension: Prec.highest([
        EditorView.domEventHandlers({ keydown(event, view) {
            if (event.key !== "Escape" || event.ctrlKey || event.metaKey || event.altKey
                || !(event.target instanceof Node) || !view.contentDOM.contains(event.target)) return false;
            const cm = getCM(view);
            if (!cm) return false;
            // Own Escape even when Vim is already Normal and reports no action.
            // Otherwise outer shortcuts/browser defaults can take editor focus.
            Vim.handleKey(cm as Parameters<typeof Vim.handleKey>[0], "<Esc>", "user");
            event.preventDefault(); event.stopPropagation(); view.focus();
            return true;
        } }),
        ViewPlugin.define(view => {
            // Extensions like Vimium handle Escape before page scripts and blur
            // the editor. The page never sees the key, so detect the orphan blur.
            let lastInput = 0;
            const input = () => { lastInput = performance.now(); };
            const focusout = () => {
                const started = performance.now();
                requestAnimationFrame(() => {
                    const active = view.root.activeElement;
                    if (started - lastInput > 150 && view.dom.ownerDocument.hasFocus() && (!active || active === view.dom.ownerDocument.body)) actionsByView.get(view)?.focusStolen();
                });
            };
            const win = view.dom.ownerDocument.defaultView!;
            for (const type of ["keydown", "pointerdown"]) win.addEventListener(type, input, true);
            view.contentDOM.addEventListener("focusout", focusout);
            return { destroy() {
                for (const type of ["keydown", "pointerdown"]) win.removeEventListener(type, input, true);
                view.contentDOM.removeEventListener("focusout", focusout);
            } };
        }),
        vim(),
    ]), attach(view) {
        actionsByView.set(view, actions);
        const cm = getCM(view);
        const mode = (event: { mode: string }) => actions.mode(["insert", "visual", "replace"].includes(event.mode) ? event.mode as VimMode : "normal");
        const labelCommand = () => cm?.state.dialog?.querySelector("input")?.setAttribute("aria-label", actions.commandLabel());
        cm?.on("vim-mode-change", mode); cm?.on("dialog", labelCommand);
        actions.mode("normal");
        return () => { cm?.off("vim-mode-change", mode); cm?.off("dialog", labelCommand); actionsByView.delete(view); };
    } };
}
