import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { hideChecklist, markCustomizeSeen, showChecklistAgain } from "@/lib/preferences/onboarding";
import { DEFAULT_CLIENT_PREFERENCES } from "@/lib/preferences/schema";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import { createEmptyResume } from "@/lib/schema";
import { useResumeStore } from "@/lib/store";
import { EditorChecklist } from "./EditorChecklist";

function reset(patch: { onboarding?: Partial<typeof DEFAULT_CLIENT_PREFERENCES.onboarding>; exports?: number } = {}) {
    localStorage.clear();
    useClientPreferencesStore.setState({
        hydrated: true,
        preferences: {
            ...DEFAULT_CLIENT_PREFERENCES,
            onboarding: { ...DEFAULT_CLIENT_PREFERENCES.onboarding, ...patch.onboarding },
            support: { ...DEFAULT_CLIENT_PREFERENCES.support, successfulExportCount: patch.exports ?? 0 },
        },
    });
    useResumeStore.setState({ resume: createEmptyResume(), sidebarTab: "content", pendingContentNav: null });
    useI18nStore.setState({ locale: "en", _hydrated: true });
}

beforeEach(() => reset());
afterEach(cleanup);

const done = (id: string) => screen.getByTestId(`editor-checklist-${id}`).dataset.done === "true";

describe("EditorChecklist", () => {
    it("starts with every step open and nothing blocking", () => {
        render(<EditorChecklist />);
        expect(screen.getByTestId("editor-checklist-progress")).toHaveTextContent("0 of 4 done");
        for (const id of ["name", "entry", "customize", "export"]) expect(done(id)).toBe(false);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("ticks steps from what the person does", () => {
        render(<EditorChecklist />);
        act(() => useResumeStore.getState().updateBasics({ name: "Amina" }));
        expect(done("name")).toBe(true);
        act(() => useResumeStore.getState().updateExperience([{ ...createEmptyResume().experience[0], id: "e1", position: "Nurse" } as never]));
        expect(done("entry")).toBe(true);
        act(() => markCustomizeSeen());
        expect(done("customize")).toBe(true);
        expect(screen.getByTestId("editor-checklist-progress")).toHaveTextContent("3 of 4 done");
    });

    it("exposes each step's state to screen readers and offers a button only for open steps", () => {
        render(<EditorChecklist />);
        expect(screen.getByTestId("editor-checklist-name")).toHaveTextContent("not done yet");
        expect(screen.getByTestId("editor-checklist-name").querySelector("button")).not.toBeNull();
        expect(screen.getByTestId("editor-checklist-export").querySelector("button")).toBeNull();
    });

    it("steps lead to the right place", () => {
        render(<EditorChecklist />);
        fireEvent.click(screen.getByTestId("editor-checklist-name").querySelector("button")!);
        expect(useResumeStore.getState().pendingContentNav).toMatchObject({ section: "basics", mode: "open" });
        fireEvent.click(screen.getByTestId("editor-checklist-entry").querySelector("button")!);
        expect(useResumeStore.getState().pendingContentNav).toMatchObject({ section: "experience", mode: "add" });
        fireEvent.click(screen.getByTestId("editor-checklist-customize").querySelector("button")!);
        expect(useResumeStore.getState().sidebarTab).toBe("customize");
    });

    it("can be hidden, stays hidden, and comes back with its steps open again", () => {
        render(<EditorChecklist />);
        fireEvent.click(screen.getByTestId("editor-checklist-hide"));
        expect(screen.queryByTestId("editor-checklist")).not.toBeInTheDocument();
        expect(JSON.parse(localStorage.getItem("enginecv-preferences")!).preferences.onboarding.checklistHidden).toBe(true);

        act(() => markCustomizeSeen());
        act(() => showChecklistAgain());
        expect(screen.getByTestId("editor-checklist")).toBeInTheDocument();
        expect(done("customize")).toBe(false);
    });

    it("hideChecklist and showChecklistAgain are what the command palette toggles", () => {
        hideChecklist();
        expect(useClientPreferencesStore.getState().preferences.onboarding.checklistHidden).toBe(true);
        showChecklistAgain();
        expect(useClientPreferencesStore.getState().preferences.onboarding).toMatchObject({ checklistHidden: false, customizeSeen: false });
    });

    it("goes away by itself when everything is done", () => {
        reset({ onboarding: { customizeSeen: true }, exports: 1 });
        render(<EditorChecklist />);
        act(() => {
            useResumeStore.getState().updateBasics({ name: "Amina" });
            useResumeStore.getState().updateExperience([{ ...createEmptyResume().experience[0], id: "e1" } as never]);
        });
        expect(screen.queryByTestId("editor-checklist")).not.toBeInTheDocument();
    });

    it("stays hidden for someone who already hid it", () => {
        reset({ onboarding: { checklistHidden: true } });
        render(<EditorChecklist />);
        expect(screen.queryByTestId("editor-checklist")).not.toBeInTheDocument();
    });

    it("is translated", () => {
        useI18nStore.setState({ locale: "de", _hydrated: true });
        render(<EditorChecklist />);
        expect(screen.getByRole("region", { name: "Erste Schritte" })).toBeInTheDocument();
        expect(screen.getByTestId("editor-checklist-progress")).toHaveTextContent("0 von 4 erledigt");
    });
});
