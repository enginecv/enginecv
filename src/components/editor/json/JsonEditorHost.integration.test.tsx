import { afterEach, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { JsonEditorHost } from "../JsonEditorLoader";
import { setJsonEditorSlot } from "../json-editor-slot";
import { useResumeStore } from "@/lib/store";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import { DEFAULT_CLIENT_PREFERENCES } from "@/lib/preferences/schema";
import { useI18nStore } from "@/lib/i18n";
import { createQaFullResume } from "@/lib/qa/sample-resumes";
import { db } from "@/lib/db";

afterEach(cleanup);
function Host({ outlet }: { outlet: string | null }) {
    return <><JsonEditorHost />{outlet && <div key={outlet} ref={setJsonEditorSlot} data-testid={outlet} />}</>;
}
it("keeps the same editor and dirty buffer when sidebar outlets disappear or move", async () => {
    Object.defineProperty(Range.prototype, "getClientRects", { configurable: true, value: () => [] });
    Object.defineProperty(Range.prototype, "getBoundingClientRect", { configurable: true, value: () => new DOMRect() });
    const resume = createQaFullResume(); await db.resumes.put(resume);
    useResumeStore.setState({ resume, activeResumeId: resume.id, sidebarTab: "json" });
    useClientPreferencesStore.setState({ preferences: structuredClone(DEFAULT_CLIENT_PREFERENCES), hydrated: true });
    useI18nStore.setState({ locale: "en", _hydrated: true });
    const rendered = render(<Host outlet="desktop" />);
    const textbox = await screen.findByRole("textbox", { name: "CV JSON" });
    const view = EditorView.findFromDOM(textbox)!;
    act(() => view.dispatch({ changes: { from: view.state.doc.length, insert: "\n " } }));
    const dirty = view.state.doc.toString();
    rendered.rerender(<Host outlet={null} />);
    expect(view.state.doc.toString()).toBe(dirty);
    rendered.rerender(<Host outlet="mobile" />);
    expect(screen.getByTestId("mobile").contains(textbox)).toBe(true);
    expect(EditorView.findFromDOM(textbox)).toBe(view);
    expect(view.state.doc.toString()).toBe(dirty);
});
