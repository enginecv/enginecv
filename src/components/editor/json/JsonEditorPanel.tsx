"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Compartment, EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { setDiagnostics } from "@codemirror/lint";
import { useTranslation } from "@/lib/i18n";
import { useResumeStore } from "@/lib/store";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import type { VimMode } from "./vim";
import { clearJsonSession, requestJsonEditorLeave, setJsonSession } from "@/lib/editor-json-session";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { Problem } from "@/lib/json-edit/problems";
import { cleanBuffer, type CleanResult } from "@/lib/json-edit/clean";
import { rangeForPath, segmentsForPath } from "@/lib/json-edit/locate";
import { createJsonEditor, schemaGuidance, problemMessage, hiddenInternalFields, foldInternalFields } from "./codemirror-setup";
import { sortKeys } from "@/lib/json-edit/sort";
import { useJsonBuffer } from "./useJsonBuffer";
import { CleanupReviewDialog } from "./CleanupReviewDialog";
import { AlignLeft, ArrowDownAZ, Check, CircleAlert, EyeOff, WandSparkles } from "lucide-react";
import { VimIcon } from "./VimIcon";

export default function JsonEditorPanel() {
    const { t, locale } = useTranslation();
    const buffer = useJsonBuffer();
    const preferences = useClientPreferencesStore(state => state.preferences.editor.jsonEditor);
    const updatePreferences = useClientPreferencesStore(state => state.updateSection);
    const current = useRef(buffer); current.current = buffer;
    const parent = useRef<HTMLDivElement>(null);
    const view = useRef<EditorView | null>(null);
    const readOnly = useRef(new Compartment());
    const guidance = useRef(new Compartment());
    const labels = useRef(new Compartment());
    const vim = useRef(new Compartment());
    const hidden = useRef(new Compartment());
    const closeAfterApply = useRef(false);
    const [closeRequested, setCloseRequested] = useState(false);
    const [vimMode, setVimMode] = useState<VimMode>("normal");
    const [vimReady, setVimReady] = useState(false);
    const [vimError, setVimError] = useState(false);
    const [vimAttempt, setVimAttempt] = useState(0);
    const [escapeStolen, setEscapeStolen] = useState(false);
    const [cursor, setCursor] = useState({ line: 1, column: 1 });
    const translate = useRef(t); translate.current = t;
    const [ready, setReady] = useState(false);
    const [leaving, setLeaving] = useState<(() => void) | null>(null);
    const [showProblems, setShowProblems] = useState(false);
    const [cleanupReview, setCleanupReview] = useState<CleanResult | null>(null);
    const [authoringDetected, setAuthoringDetected] = useState(false);
    const reviewCleanup = (text: string) => { const result = cleanBuffer(text); setAuthoringDetected(Boolean(result.authoring)); setCleanupReview(result); };
    const tab = useResumeStore(s => s.sidebarTab);
    const jump = (problem?: Problem) => {
        if (!problem || !view.current) return;
        const from = Math.min(problem.from, view.current.state.doc.length);
        view.current.dispatch({ selection: { anchor: from }, effects: EditorView.scrollIntoView(from, { y: "center" }) }); view.current.focus();
    };
    const live = preferences.applyMode === "live";
    const liveRef = useRef(live); liveRef.current = live;
    const setPreference = (patch: Partial<typeof preferences>) => updatePreferences("editor", { jsonEditor: { ...preferences, ...patch } });
    // Ctrl/Cmd+S inside the editor: apply in On save mode, flush and save in Live mode.
    const saveShortcut = () => {
        if (!liveRef.current) { void apply(); return; }
        if (current.current.applyLive()) void useResumeStore.getState().saveToDb("manual");
    };
    const apply = async (closeAfter = false, force = false) => {
        closeAfterApply.current = closeAfter;
        const { problem, applied } = await current.current.requestApply(force);
        if (applied && closeAfterApply.current) setCloseRequested(true);
        else if (!applied && problem) closeAfterApply.current = false;
        jump(problem ?? undefined);
    };

    useEffect(() => {
        const editor = createJsonEditor(parent.current!, current.current.text, t("jsonEditor.inputLabel"), text => { current.current.setText(text); setAuthoringDetected(false); }, [readOnly.current.of(EditorState.readOnly.of(false)), guidance.current.of(schemaGuidance(t)), labels.current.of(EditorView.contentAttributes.of({ "aria-label": t("jsonEditor.inputLabel") })), vim.current.of([]), Prec.high(keymap.of([{ key: "Mod-s", run: () => { saveShortcut(); return true; } }])), EditorView.updateListener.of(update => {
            if (!update.selectionSet && !update.docChanged) return;
            const head = update.state.selection.main.head, line = update.state.doc.lineAt(head);
            setCursor(previous => previous.line === line.number && previous.column === head - line.from + 1 ? previous : { line: line.number, column: head - line.from + 1 });
        }), hidden.current.of(preferences.hideInternal ? hiddenInternalFields(t("jsonEditor.hiddenId")) : []), EditorView.domEventHandlers({ paste(event, editor) {
            if (editor.state.readOnly) return false;
            const selection = editor.state.selection.main;
            if (editor.state.doc.length > 0 && (selection.to - selection.from) / editor.state.doc.length < 0.9) return false;
            const pasted = event.clipboardData?.getData("text/plain");
            if (!pasted) return false;
            event.preventDefault();
            const proposed = editor.state.sliceDoc(0, selection.from) + pasted + editor.state.sliceDoc(selection.to);
            reviewCleanup(proposed);
            return true;
        } })]);
        view.current = editor; setReady(true);
        return () => { editor.destroy(); view.current = null; };
        // CodeMirror owns its document; React mirrors changes for validation.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        const editor = view.current;
        if (editor && editor.state.doc.toString() !== buffer.text) editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: buffer.text } });
    }, [buffer.text]);
    useEffect(() => {
        view.current?.dispatch({ effects: readOnly.current.reconfigure(EditorState.readOnly.of(buffer.status === "applying")) });
    }, [buffer.status]);
    useEffect(() => {
        view.current?.dispatch({ effects: hidden.current.reconfigure(preferences.hideInternal ? hiddenInternalFields(t("jsonEditor.hiddenId")) : []) });
        // Only visual preference/locale changes rebuild the decorations.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preferences.hideInternal, locale]);
    useEffect(() => { if (view.current) foldInternalFields(view.current, preferences.hideInternal); }, [buffer.text, preferences.hideInternal]);
    useEffect(() => {
        view.current?.dispatch({ effects: [guidance.current.reconfigure(schemaGuidance(t)), labels.current.reconfigure(EditorView.contentAttributes.of({ "aria-label": t("jsonEditor.inputLabel") }))] });
        // Reconfigure only when the effective locale changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locale]);
    useEffect(() => {
        if (view.current) {
            const length = view.current.state.doc.length;
            view.current.dispatch(setDiagnostics(view.current.state, buffer.validation.problems.map(problem => ({ from: Math.min(problem.from, length), to: Math.min(problem.to, length), severity: problem.severity, message: problemMessage(problem, t) }))));
        }
    }, [buffer.validation, t]);
    useEffect(() => {
        setJsonSession({ dirty: buffer.dirty, undo: buffer.lastApply ? () => { void current.current.undoApply(); } : null, leave: next => setLeaving(() => next) });
    }, [buffer.dirty, buffer.lastApply]);
    useEffect(() => {
        if (!closeRequested || buffer.dirty) return;
        closeAfterApply.current = false; setCloseRequested(false);
        useResumeStore.getState().setSidebarTab("content");
    }, [closeRequested, buffer.dirty]);
    useEffect(() => {
        let cancelled = false;
        let detach: (() => void) | undefined;
        setVimReady(false); setVimError(false);
        if (!preferences.vim) view.current?.dispatch({ effects: vim.current.reconfigure([]) });
        else void import("./vim").then(module => module.loadVim({
            apply: closeAfter => { void apply(closeAfter); },
            close: () => useResumeStore.getState().setSidebarTab("content"),
            mode: setVimMode,
            commandLabel: () => translate.current("jsonEditor.vimCommand"),
            focusStolen: () => setEscapeStolen(true),
        })).then(loaded => {
            if (cancelled || !view.current) return;
            view.current.dispatch({ effects: vim.current.reconfigure(loaded.extension) });
            detach = loaded.attach(view.current); setVimReady(true);
        }).catch(() => { if (!cancelled) setVimError(true); });
        return () => { cancelled = true; detach?.(); };
        // Actions read the live buffer through refs, not the loading render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [preferences.vim, vimAttempt]);
    useEffect(() => {
        if (!live || !buffer.dirty || buffer.status !== "ready") return;
        const timer = setTimeout(() => current.current.applyLive(), 400);
        return () => clearTimeout(timer);
    }, [live, buffer.text, buffer.dirty, buffer.status]);
    useEffect(() => () => clearJsonSession(), []);
    const previousTab = useRef(tab);
    useEffect(() => {
        if (tab === "json" && previousTab.current !== "json" && !current.current.dirty) void current.current.reloadLatest();
        previousTab.current = tab;
    }, [tab]);
    useEffect(() => {
        if (!buffer.dirty) return;
        const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
        const link = (event: MouseEvent) => {
            const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
            if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download") || event.ctrlKey || event.metaKey) return;
            if (anchor.href === window.location.href || anchor.hash && anchor.pathname === location.pathname) return;
            event.preventDefault(); event.stopPropagation();
            requestJsonEditorLeave(() => window.location.assign(anchor.href));
        };
        let restoring = false;
        const pop = (event: PopStateEvent) => {
            event.stopImmediatePropagation();
            if (restoring) { restoring = false; return; }
            const destination = window.location.href;
            restoring = true;
            window.history.go(1);
            requestJsonEditorLeave(() => window.location.assign(destination));
        };
        window.addEventListener("beforeunload", unload); document.addEventListener("click", link, true);
        window.addEventListener("popstate", pop, true);
        return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", link, true); window.removeEventListener("popstate", pop, true); };
    }, [buffer.dirty]);

    const segmentGroup = "inline-flex h-7 items-center rounded-md border border-edge bg-surface-2/60 p-0.5";
    const segment = (on: boolean) => `inline-flex h-full items-center gap-1 rounded px-1.5 text-[11px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1 disabled:opacity-40 ${on ? "bg-surface-1 text-strong shadow-sm" : "text-mid hover:text-strong"}`;
    const toolClass = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-mid transition-colors hover:bg-surface-2 hover:text-strong focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-40";
    return <section aria-label={t("jsonEditor.tab")} data-testid="json-editor-panel" className="flex flex-1 min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-edge bg-surface-1">
        <div role="toolbar" aria-label={t("jsonEditor.toolbar")} className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-edge p-1.5">
            <div className="flex items-center gap-0.5">
                <button type="button" aria-label={t("jsonEditor.format")} disabled={buffer.validation.status === "invalid" || buffer.status === "applying"} title={t(buffer.validation.status === "invalid" ? "jsonEditor.formatInvalid" : "jsonEditor.format")} onClick={() => { try { buffer.setText(JSON.stringify(JSON.parse(buffer.text), null, 2)); } catch { void apply(); } }} className={toolClass}><AlignLeft size={16} aria-hidden="true" /></button>
                <button type="button" aria-label={t("jsonEditor.sort")} disabled={buffer.validation.status === "invalid" || buffer.status === "applying"} title={t(buffer.validation.status === "invalid" ? "jsonEditor.formatInvalid" : "jsonEditor.sort")} onClick={() => { try { buffer.setText(sortKeys(buffer.text)); } catch { void apply(); } }} className={toolClass}><ArrowDownAZ size={16} aria-hidden="true" /></button>
                <button type="button" aria-label={t("jsonEditor.clean")} title={t("jsonEditor.clean")} disabled={buffer.status === "applying"} onClick={() => reviewCleanup(buffer.text)} className={toolClass}><WandSparkles size={16} aria-hidden="true" /></button>
                <span aria-hidden="true" className="mx-1 h-4 border-l border-edge" />
                <button type="button" aria-label={t("jsonEditor.hideInternal")} title={t("jsonEditor.hideInternal")} aria-pressed={preferences.hideInternal} disabled={buffer.status === "applying"} onClick={() => updatePreferences("editor", { jsonEditor: { ...preferences, hideInternal: !preferences.hideInternal } })} className={`${toolClass} ${preferences.hideInternal ? "bg-surface-2 text-strong" : ""}`}><EyeOff size={16} aria-hidden="true" /></button>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
                <div role="group" aria-label={t("jsonEditor.editorMode")} className={segmentGroup}>
                    <button type="button" aria-pressed={!preferences.vim} disabled={buffer.status === "applying"} onClick={() => setPreference({ vim: false })} className={segment(!preferences.vim)}>{t("jsonEditor.editorStandard")}</button>
                    <button type="button" aria-pressed={preferences.vim} disabled={buffer.status === "applying"} onClick={() => setPreference({ vim: true })} className={segment(preferences.vim)}><VimIcon className="h-3 w-3" />{t("jsonEditor.vim")}</button>
                </div>
                <div role="group" aria-label={t("jsonEditor.applyMode")} className={segmentGroup}>
                    <button type="button" aria-pressed={live} title={t("jsonEditor.applyLiveHint")} onClick={() => setPreference({ applyMode: "live" })} className={segment(live)}>{t("jsonEditor.applyLive")}</button>
                    <button type="button" aria-pressed={!live} title={t("jsonEditor.applyOnSaveHint")} onClick={() => setPreference({ applyMode: "save" })} className={segment(!live)}>{t("jsonEditor.applyOnSave")}</button>
                </div>
                {!live && <button type="button" disabled={!buffer.dirty || buffer.status === "applying"} title={t("jsonEditor.applyShortcut")} onClick={() => void apply()} className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:pointer-events-none ${buffer.dirty ? "bg-accent/10 text-accent hover:bg-accent/20" : "text-mid opacity-60"}`}><Check size={13} aria-hidden="true" />{t(buffer.status === "applying" ? "jsonEditor.applying" : "jsonEditor.apply")}</button>}
            </div>
        </div>
        {!ready && <p role="status">{t("jsonEditor.loading")}</p>}
        {buffer.saveError && <p role="alert" className="text-danger">{t("jsonEditor.saveError")}</p>}
        {(buffer.validation.problems.some(problem => problem.code === "authoring-format") || authoringDetected) && <p role="alert" className="text-sm text-accent">{t("jsonEditor.problem.authoring-format")} <Link href="/dashboard?start=ai" className="underline">{t("jsonEditor.pasteFromAI")}</Link></p>}
        {buffer.lastApply && <div role="status" className="rounded-lg border border-edge bg-surface-2 p-2 text-sm"><span>{t("jsonEditor.applied")}</span> <button type="button" onClick={() => void buffer.undoApply()} className="text-accent underline">{t("jsonEditor.undo")}</button></div>}
        {showProblems && <ul aria-label={t("jsonEditor.problemList")} className="max-h-40 overflow-auto text-xs">{buffer.validation.problems.map((problem, i) => <li key={i}><button type="button" className="w-full p-2 text-left break-words" onClick={() => jump(problem)}>{t("jsonEditor.location", { line: problem.line, column: problem.column })}: {problemMessage(problem, t)}</button></li>)}</ul>}
        <div ref={parent} className="min-h-0 flex-1 overflow-hidden" />
        {preferences.vim && escapeStolen && <p role="status" className="flex shrink-0 items-start justify-between gap-2 border-t border-edge px-2 py-1.5 text-xs text-mid"><span>{t("jsonEditor.vimEscapeStolen")}</span><button type="button" onClick={() => setEscapeStolen(false)} className="shrink-0 text-accent underline">{t("jsonEditor.dismiss")}</button></p>}
        <div data-testid="json-editor-statusbar" className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-edge bg-surface-2/50 px-2 py-1 text-xs">
            <div className="flex min-w-0 items-center gap-2">
                {preferences.vim && <VimIcon className="h-4 w-4 text-strong" />}
                {preferences.vim && <div role="status" aria-label={t("jsonEditor.vimStatus", { mode: t(`jsonEditor.vimMode.${vimMode}`) })} className="min-w-0 font-mono text-[11px] font-medium tracking-wide text-strong">
                    {vimError || !vimReady ? t(vimError ? "jsonEditor.vimError" : "jsonEditor.vimLoading") : <span data-vim-mode={vimMode} className={vimMode === "normal" ? "" : "text-accent"}>{t(`jsonEditor.vimMode.${vimMode}`).toLocaleUpperCase(locale)}</span>}
                    {vimError && <button type="button" onClick={() => setVimAttempt(value => value + 1)} className="ml-2 text-accent underline">{t("jsonEditor.retry")}</button>}
                </div>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
            <span data-testid="json-editor-cursor" className="font-mono text-[11px] tabular-nums text-mid"><span aria-hidden="true">{t("jsonEditor.cursor", cursor)}</span><span className="sr-only">{t("jsonEditor.location", cursor)}</span></span>
            <button type="button" aria-label={t("jsonEditor.problems", { count: buffer.validation.problems.length })} title={t("jsonEditor.problems", { count: buffer.validation.problems.length })} aria-expanded={showProblems} onClick={() => setShowProblems(value => !value)} className={`inline-flex h-7 items-center gap-1.5 rounded px-1 font-mono focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 ${buffer.validation.problems.length ? "text-danger" : "text-mid hover:text-strong"}`}><CircleAlert size={13} aria-hidden="true" /><span>{buffer.validation.problems.length}</span></button>
            </div>
        </div>
        {cleanupReview && <CleanupReviewDialog result={cleanupReview} onDismiss={() => setCleanupReview(null)} onAccept={() => { if (cleanupReview.text !== undefined) buffer.setText(cleanupReview.text); setCleanupReview(null); }} onJump={path => {
            const range = rangeForPath(buffer.text, segmentsForPath(path));
            if (range && view.current) view.current.dispatch({ selection: { anchor: range.from }, effects: EditorView.scrollIntoView(range.from, { y: "center" }) });
        }} />}
        <ConfirmModal open={buffer.status === "stale"} title={t("jsonEditor.staleTitle")} description={t("jsonEditor.staleDescription")} confirmLabel={t("jsonEditor.applyAnyway")} onConfirm={() => void apply(closeAfterApply.current, true)} onCancel={() => { closeAfterApply.current = false; buffer.cancel(); }} secondaryAction={{ label: t("jsonEditor.reload"), onClick: () => { buffer.cancel(); setLeaving(() => () => {}); } }} />
        <ConfirmModal open={leaving !== null} title={t("jsonEditor.discardTitle")} description={t("jsonEditor.discardDescription")} confirmLabel={t("jsonEditor.discard")} onCancel={() => setLeaving(null)} onConfirm={() => { const next = leaving; setLeaving(null); void buffer.reloadLatest().then(() => next?.()); }} destructive />
        <ConfirmModal open={buffer.status === "undo-confirm"} title={t("jsonEditor.undoTitle")} description={t("jsonEditor.undoDescription")} confirmLabel={t("jsonEditor.undo")} onCancel={buffer.cancel} onConfirm={() => void buffer.undoApply(true)} destructive />
    </section>;
}
