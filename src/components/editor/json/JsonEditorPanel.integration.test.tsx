import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { currentCompletions, startCompletion } from "@codemirror/autocomplete";
import { diagnosticCount, forEachDiagnostic } from "@codemirror/lint";
import { rangeForPath } from "@/lib/json-edit/locate";
import { db } from "@/lib/db";
import { useResumeStore } from "@/lib/store";
import { useI18nStore } from "@/lib/i18n";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import { DEFAULT_CLIENT_PREFERENCES } from "@/lib/preferences/schema";
import { createQaFullResume, QA_RESUME_FIXTURES } from "@/lib/qa/sample-resumes";
import JsonEditorPanel from "./JsonEditorPanel";
import { resumeToAuthoring } from "@/lib/agent/authoring/from-resume";

const vimMock = vi.hoisted(() => ({ imported: vi.fn(), load: vi.fn(async (actions: { mode: (mode: string) => void }) => ({ extension: [], attach: () => { actions.mode("normal"); return () => {}; } })) }));
vi.mock("./vim", () => { vimMock.imported(); return { loadVim: vimMock.load }; });

function editor() { return EditorView.findFromDOM(document.querySelector(".cm-editor")!)!; }
function replaceText(text: string) {
    act(() => { const view = editor(); view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }); });
}
function edit(change: (value: ReturnType<typeof createQaFullResume>) => void) {
    const value = JSON.parse(editor().state.doc.toString()); change(value); replaceText(JSON.stringify(value, null, 2));
}
const withoutTimestamp = (resume: ReturnType<typeof createQaFullResume>) => { const { updatedAt, ...rest } = resume; void updatedAt; return rest; };

beforeEach(async () => {
    Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [] });
    Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => new DOMRect() });
    useClientPreferencesStore.setState({ preferences: structuredClone(DEFAULT_CLIENT_PREFERENCES), hydrated: true });
    useI18nStore.setState({ locale: "en", _hydrated: true });
    const resume = createQaFullResume();
    await db.resumes.clear(); await db.resumeHistory.clear(); await db.resumes.put(resume);
    useResumeStore.setState({ resume, activeResumeId: resume.id, sidebarTab: "json", isDirty: false, isSaving: false });
});

describe("live JSON guidance", () => {
    it("marks syntax errors and shows line/column in the problem list", async () => {
        render(<JsonEditorPanel />); await screen.findByRole("textbox", { name: "CV JSON" });
        replaceText('{\n"meta": { "title": "x", }\n}');
        await waitFor(() => expect(diagnosticCount(editor().state)).toBe(1));
        fireEvent.click(screen.getByRole("button", { name: "Problems: 1" }));
        expect(screen.getByRole("list", { name: "JSON problems" })).toHaveTextContent("Line 2, column");
        expect(screen.getByRole("list", { name: "JSON problems" })).toHaveTextContent("Invalid JSON syntax");
    });
    it("names wrong-type paths and jumps to their exact offsets", async () => {
        render(<JsonEditorPanel />); await screen.findByRole("textbox", { name: "CV JSON" });
        edit(v => { Object.assign(v.experience[0], { position: 17 }); });
        await waitFor(() => expect(diagnosticCount(editor().state)).toBe(1));
        const messages: string[] = [];
        forEachDiagnostic(editor().state, diagnostic => messages.push(diagnostic.message));
        expect(messages[0]).toContain("experience[0].position: Expected text");
        fireEvent.click(screen.getByRole("button", { name: "Problems: 1" }));
        fireEvent.click(screen.getByRole("button", { name: /experience\[0\]\.position: Expected text/ }));
        expect(editor().state.selection.main.from).toBe(rangeForPath(editor().state.doc.toString(), ["experience", 0, "position"])!.from);
    });
    it("uses CodeMirror's completion state to offer experience keys only", async () => {
        render(<JsonEditorPanel />); await screen.findByRole("textbox", { name: "CV JSON" });
        const text = editor().state.doc.toString().replace('"company":', '"co":');
        replaceText(text);
        act(() => { const view = editor(); view.dispatch({ selection: { anchor: text.indexOf('"co":') + 3 } }); view.focus(); startCompletion(view); });
        await waitFor(() => expect(currentCompletions(editor().state).map(option => option.label)).toContain("company"));
        expect(currentCompletions(editor().state).map(option => option.label)).not.toContain("institution");
    });
});

describe("cleanup review", () => {
    it("keeps the Paste from AI link available after dismissing fenced authoring input", async () => {
        const authoring = resumeToAuthoring(createQaFullResume());
        render(<JsonEditorPanel />); await screen.findByRole("textbox", { name: "CV JSON" });
        const raw = editor().state.doc.toString();
        act(() => { editor().dispatch({ selection: { anchor: 0, head: editor().state.doc.length } }); });
        fireEvent.paste(editor().contentDOM, { clipboardData: { getData: () => "```json\n" + JSON.stringify(authoring) + "\n```" } });
        fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
        expect(screen.getByRole("link", { name: "Open Paste from AI" })).toHaveAttribute("href", "/dashboard?start=ai");
        expect(editor().state.doc.toString()).toBe(raw);
    });
    it("keeps raw text on Dismiss and changes it only on Accept", async () => {
        const original = structuredClone(useResumeStore.getState().resume);
        render(<JsonEditorPanel />); await screen.findByRole("textbox", { name: "CV JSON" });
        edit(v => { v.experience[0].start = "March 2021"; });
        const raw = editor().state.doc.toString();
        fireEvent.click(screen.getByRole("button", { name: "Clean up" }));
        expect(screen.getByRole("dialog", { name: "Review cleanup" })).toHaveTextContent("2021-03");
        fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
        expect(editor().state.doc.toString()).toBe(raw);
        fireEvent.click(screen.getByRole("button", { name: "Clean up" }));
        fireEvent.click(screen.getByRole("button", { name: "Accept cleanup" }));
        expect(JSON.parse(editor().state.doc.toString()).experience[0].start).toBe("2021-03");
        expect(useResumeStore.getState().resume).toEqual(original);
    });
    it("reviews whole-document paste before replacing the buffer", async () => {
        render(<JsonEditorPanel />); await screen.findByRole("textbox", { name: "CV JSON" });
        const raw = editor().state.doc.toString();
        act(() => { editor().dispatch({ selection: { anchor: 0, head: editor().state.doc.length } }); });
        fireEvent.paste(editor().contentDOM, { clipboardData: { getData: () => "```json\n" + raw + "\n```" } });
        expect(screen.getByRole("dialog", { name: "Review cleanup" })).toHaveTextContent("Took the CV out of a code block");
        expect(editor().state.doc.toString()).toBe(raw);
        fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
        expect(editor().state.doc.toString()).toBe(raw);
    });
});

describe("optional Vim", () => {
    it("loads only when enabled and persists through remount in existing preferences", async () => {
        render(<JsonEditorPanel />); await screen.findByRole("textbox", { name: "CV JSON" });
        expect(vimMock.imported).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Vim" })).toHaveAttribute("aria-pressed", "false");
        fireEvent.click(screen.getByRole("button", { name: "Vim" }));
        await waitFor(() => expect(vimMock.load).toHaveBeenCalled());
        expect(useClientPreferencesStore.getState().preferences.editor.jsonEditor.vim).toBe(true);
        expect(JSON.parse(localStorage.getItem("enginecv-preferences")!).preferences.editor.jsonEditor.vim).toBe(true);
        cleanup(); render(<JsonEditorPanel />);
        expect(await screen.findByRole("button", { name: "Vim" })).toHaveAttribute("aria-pressed", "true");
        expect(await screen.findByText("NORMAL")).toBeVisible();
        const statusbar = screen.getByTestId("json-editor-statusbar");
        expect(screen.getByRole("group", { name: "Editor mode" })).toContainElement(screen.getByRole("button", { name: "Vim" }));
        fireEvent.click(screen.getByRole("button", { name: "Standard" }));
        expect(useClientPreferencesStore.getState().preferences.editor.jsonEditor.vim).toBe(false);
        fireEvent.click(screen.getByRole("button", { name: "Vim" }));
        expect(statusbar.querySelector("svg path")).toBeTruthy();
        expect((await screen.findByText("NORMAL")).parentElement).toHaveClass("font-mono");
    });
});

describe("JSON readability tools", () => {
    it("hides ids without removing text and keeps ids/photo/history with reordered entries", async () => {
        const original = structuredClone(useResumeStore.getState().resume);
        render(<JsonEditorPanel />); await screen.findByRole("textbox", { name: "CV JSON" });
        expect(screen.getByRole("button", { name: "Hide internal fields" })).toHaveAttribute("aria-pressed", "true");
        expect(document.querySelector(".json-internal-id")).toBeTruthy();
        expect(editor().state.doc.toString()).toContain(original.experience[0].id);
        edit(v => { [v.experience[0], v.experience[1]] = [v.experience[1], v.experience[0]]; v.experience[0].position = "Readable"; });
        fireEvent.click(screen.getByRole("button", { name: "Apply" }));
        await waitFor(async () => expect(await db.resumeHistory.where("trigger").equals("json-edit").count()).toBe(1));
        expect(useResumeStore.getState().resume.experience[0].id).toBe(original.experience[1].id);
        expect(useResumeStore.getState().resume.basics.photo).toBe(original.basics.photo);
        expect(useResumeStore.getState().resume.aiHistory).toEqual(original.aiHistory);
        fireEvent.click(screen.getByRole("button", { name: "Hide internal fields" }));
        expect(document.querySelector(".json-internal-id")).toBeNull();
    });
    it("shows the cursor line and column in the status bar", async () => {
        render(<JsonEditorPanel />); await screen.findByRole("textbox", { name: "CV JSON" });
        expect(screen.getByTestId("json-editor-cursor")).toHaveTextContent("Ln 1, Col 1");
        const line = editor().state.doc.line(3);
        act(() => editor().dispatch({ selection: { anchor: line.from + 4 } }));
        expect(screen.getByTestId("json-editor-cursor")).toHaveTextContent("Ln 3, Col 5");
        expect(screen.getByTestId("json-editor-cursor")).toHaveTextContent("Line 3, column 5");
    });
    it("formats and sorts without changing values", async () => {
        render(<JsonEditorPanel />); await screen.findByRole("textbox", { name: "CV JSON" });
        const value = JSON.parse(editor().state.doc.toString());
        replaceText(JSON.stringify(value));
        fireEvent.click(screen.getByRole("button", { name: "Format" }));
        expect(editor().state.doc.toString()).toBe(JSON.stringify(value, null, 2));
        fireEvent.click(screen.getByRole("button", { name: "Sort keys" }));
        expect(JSON.parse(editor().state.doc.toString())).toEqual(value);
    });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("JSON editor apply boundary", () => {
    for (const fixture of QA_RESUME_FIXTURES.filter(fixture => fixture.id !== "qa-full")) it(`apply and undo restore all stored fields for ${fixture.id}`, async () => {
        const original = fixture.create(); await db.resumes.put(original);
        useResumeStore.setState({ resume: original, activeResumeId: original.id });
        render(<JsonEditorPanel />); await screen.findByRole("textbox", { name: "CV JSON" });
        edit(value => { value.meta.title += " JSON"; });
        fireEvent.click(screen.getByRole("button", { name: "Apply" }));
        await waitFor(async () => expect(await db.resumeHistory.where("trigger").equals("json-edit").count()).toBe(1));
        fireEvent.click(await screen.findByRole("button", { name: "Undo apply" }));
        await waitFor(async () => expect(await db.resumeHistory.where("trigger").equals("restore").count()).toBe(1));
        expect(withoutTimestamp(useResumeStore.getState().resume)).toEqual(withoutTimestamp(original));
    });
    it("starts ready with Apply disabled, saves without a review dialog and restores it in one undo", async () => {
        const original = structuredClone(useResumeStore.getState().resume);
        render(<JsonEditorPanel />);
        expect(await screen.findByRole("textbox", { name: "CV JSON" })).toBeVisible();
        expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
        edit(value => { value.experience[0].position = "JSON Architect"; [value.experience[0], value.experience[1]] = [value.experience[1], value.experience[0]]; });
        fireEvent.click(screen.getByRole("button", { name: "Apply" }));
        await waitFor(async () => expect(await db.resumeHistory.where("trigger").equals("json-edit").count()).toBe(1));
        await screen.findByRole("button", { name: "Undo apply" });
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(useResumeStore.getState().resume.experience[1].position).toBe("JSON Architect");
        expect((await db.resumeHistory.toArray()).some(entry => entry.trigger === "json-edit")).toBe(true);
        fireEvent.click(screen.getByRole("button", { name: "Undo apply" }));
        await waitFor(() => expect(withoutTimestamp(useResumeStore.getState().resume)).toEqual(withoutTimestamp(original)));
        expect((await db.resumeHistory.toArray()).some(entry => entry.trigger === "restore")).toBe(true);
    });
    it("applies with Ctrl+S inside the editor in On save mode", async () => {
        render(<JsonEditorPanel />); await screen.findByRole("textbox", { name: "CV JSON" });
        edit(v => { v.basics.name = "Saved by shortcut"; });
        fireEvent.keyDown(editor().contentDOM, { key: "s", ctrlKey: true });
        await waitFor(() => expect(useResumeStore.getState().resume.basics.name).toBe("Saved by shortcut"));
        expect(await db.resumeHistory.where("trigger").equals("json-edit").count()).toBe(1);
    });
    it("Live mode updates the CV from valid edits and waits on invalid ones", async () => {
        render(<JsonEditorPanel />); await screen.findByRole("textbox", { name: "CV JSON" });
        fireEvent.click(screen.getByRole("button", { name: "Live" }));
        expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
        edit(v => { v.basics.name = "Typed live"; });
        await waitFor(() => expect(useResumeStore.getState().resume.basics.name).toBe("Typed live"));
        expect(useResumeStore.getState().isDirty).toBe(true);
        const text = editor().state.doc.toString();
        replaceText(text.replace('"Typed live"', '"Broken'));
        await new Promise(resolve => setTimeout(resolve, 600));
        expect(useResumeStore.getState().resume.basics.name).toBe("Typed live");
        replaceText(text.replace('"Typed live"', '"Fixed live"'));
        await waitFor(() => expect(useResumeStore.getState().resume.basics.name).toBe("Fixed live"));
        expect(await db.resumeHistory.where("trigger").equals("json-edit").count()).toBe(0);
    });
    it("treats a whitespace-only edit as a silent no-op", async () => {
        render(<JsonEditorPanel />); await screen.findByRole("textbox", { name: "CV JSON" });
        const loaded = editor().state.doc.toString();
        replaceText(loaded + "\n");
        fireEvent.click(screen.getByRole("button", { name: "Apply" }));
        await waitFor(() => expect(editor().state.doc.toString()).toBe(loaded));
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(screen.queryByRole("button", { name: "Undo apply" })).toBeNull();
        expect(await db.resumeHistory.count()).toBe(0);
    });
    it("blocks invalid data and selects its first problem", async () => {
        const original = useResumeStore.getState().resume;
        render(<JsonEditorPanel />); await screen.findByRole("textbox", { name: "CV JSON" });
        replaceText('{\n"meta": 42\n}');
        fireEvent.click(screen.getByRole("button", { name: "Apply" }));
        expect(useResumeStore.getState().resume).toEqual(original);
        await waitFor(() => expect(editor().state.selection.main.from).toBeGreaterThan(0));
        expect(await db.resumeHistory.count()).toBe(0);
    });
    it("detects stale store changes and supports reload with discard review", async () => {
        render(<JsonEditorPanel />); await screen.findByRole("textbox", { name: "CV JSON" });
        edit(v => { v.basics.name = "Buffered"; });
        act(() => useResumeStore.getState().updateBasics({ name: "Later form edit" }));
        fireEvent.click(screen.getByRole("button", { name: "Apply" }));
        expect(await screen.findByRole("dialog", { name: "This CV changed" })).toBeVisible();
        fireEvent.click(screen.getByRole("button", { name: "Reload latest" }));
        expect(await screen.findByRole("dialog", { name: "Discard unapplied JSON edits?" })).toBeVisible();
        fireEvent.click(screen.getByRole("button", { name: "Discard edits" }));
        await waitFor(() => expect(editor().state.doc.toString()).toContain("Later form edit"));
    });
    it("uses German labels and applies anyway after stale review", async () => {
        useI18nStore.setState({ locale: "de", _hydrated: true });
        render(<JsonEditorPanel />); await screen.findByRole("textbox", { name: "Lebenslauf-JSON" });
        edit(v => { v.basics.name = "JSON Name"; });
        act(() => useResumeStore.getState().updateBasics({ name: "Neu" }));
        fireEvent.click(screen.getByRole("button", { name: "Anwenden" }));
        fireEvent.click(await screen.findByRole("button", { name: "Trotzdem anwenden" }));
        await waitFor(() => expect(useResumeStore.getState().resume.basics.name).toBe("JSON Name"));
    });
    it("detects a saved change from another tab", async () => {
        render(<JsonEditorPanel />); await screen.findByRole("textbox", { name: "CV JSON" });
        edit(v => { v.basics.name = "Buffered"; });
        const saved = structuredClone(useResumeStore.getState().resume); saved.basics.name = "Other tab";
        await db.resumes.put(saved);
        fireEvent.click(screen.getByRole("button", { name: "Apply" }));
        expect(await screen.findByRole("dialog", { name: "This CV changed" })).toBeVisible();
    });
    it("keeps the buffer and restores the store if persistence fails", async () => {
        const original = structuredClone(useResumeStore.getState().resume);
        render(<JsonEditorPanel />); await screen.findByRole("textbox", { name: "CV JSON" });
        edit(v => { v.basics.name = "Recoverable"; });
        vi.spyOn(db.resumes, "put").mockRejectedValueOnce(new Error("quota"));
        fireEvent.click(screen.getByRole("button", { name: "Apply" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
        expect(useResumeStore.getState().resume).toEqual(original);
        expect(editor().state.doc.toString()).toContain("Recoverable");
        expect(await db.resumeHistory.count()).toBe(0);
    });
});
