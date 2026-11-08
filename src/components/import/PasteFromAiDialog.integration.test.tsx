import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resumeToAuthoring, serializeAuthoring } from "@/lib/agent/authoring";
import { db } from "@/lib/db";
import { useI18nStore } from "@/lib/i18n";
import { createQaFullResume } from "@/lib/qa/sample-resumes";
import PasteFromAiDialog from "./PasteFromAiDialog";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: pushMock }),
}));

const SIMPLE = JSON.stringify({
    format: "enginecv.authoring/v1",
    basics: { name: "Amina Hodžić" },
    experience: [{ position: "Nurse", company: "KCUS", start: "2019-03", end: "present" }],
    skills: ["Intensive care", "Wound care"],
});

/** Types into the text area and lets the 200 ms debounce run. */
async function paste(text: string) {
    fireEvent.change(screen.getByTestId("paste-from-ai-input"), { target: { value: text } });
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 260));
    });
}

describe("PasteFromAiDialog", () => {
    beforeEach(async () => {
        await db.resumes.clear();
        await db.resumeHistory.clear();
        pushMock.mockClear();
        useI18nStore.setState({ locale: "en", _hydrated: true });
    });

    afterEach(async () => {
        cleanup();
        await db.resumes.clear();
        await db.resumeHistory.clear();
    });

    it("starts empty with Create CV disabled and no message", () => {
        render(<PasteFromAiDialog open onClose={vi.fn()} />);
        expect(screen.getByRole("dialog", { name: "Paste from AI" })).toBeInTheDocument();
        expect(screen.getByTestId("paste-from-ai-import")).toBeDisabled();
        expect(screen.queryByTestId("paste-from-ai-blocked")).not.toBeInTheDocument();
        expect(screen.queryByTestId("paste-from-ai-summary")).not.toBeInTheDocument();
    });

    it("explains why a text cannot be imported", async () => {
        render(<PasteFromAiDialog open onClose={vi.fn()} />);

        await paste("Sorry, I cannot help with that.");
        expect(screen.getByTestId("paste-from-ai-blocked")).toHaveTextContent("No CV found in this text");
        expect(screen.getByTestId("paste-from-ai-import")).toBeDisabled();

        await paste('Here:\n{\n  "basics": {\n    "name": "A" "headline": "B"\n  }\n}');
        expect(screen.getByTestId("paste-from-ai-blocked")).toHaveTextContent(/mistake on line 4, column \d+/);

        await paste(`{"summary":"${"x".repeat(210 * 1024)}"}`);
        expect(screen.getByTestId("paste-from-ai-blocked")).toHaveTextContent("larger than 200 KB");
    });

    it("waits for typing to pause before reading the text", async () => {
        render(<PasteFromAiDialog open onClose={vi.fn()} />);
        fireEvent.change(screen.getByTestId("paste-from-ai-input"), { target: { value: SIMPLE } });
        expect(screen.queryByTestId("paste-from-ai-summary")).not.toBeInTheDocument();
        expect(screen.getByTestId("paste-from-ai-import")).toBeDisabled();
        expect(await screen.findByTestId("paste-from-ai-summary")).toBeInTheDocument();
    });

    it("summarises a clean document per section, with no notes", async () => {
        render(<PasteFromAiDialog open onClose={vi.fn()} />);
        await paste(SIMPLE);

        expect(screen.getByTestId("paste-from-ai-summary-name")).toHaveTextContent("Amina Hodžić");
        expect(screen.getByTestId("paste-from-ai-section-experience")).toHaveTextContent("Professional Experience1 entry");
        expect(screen.getByTestId("paste-from-ai-section-skills")).toHaveTextContent("2 skills");
        expect(screen.queryByTestId("paste-from-ai-notice")).not.toBeInTheDocument();
        expect(screen.getByTestId("paste-from-ai-import")).toBeEnabled();
    });

    it("lists every repair and adjustment, grouped, with its place in the document", async () => {
        render(<PasteFromAiDialog open onClose={vi.fn()} />);
        await paste(
            "Here is your CV:\n```json\n"
            + '{"format":"enginecv.authoring/v1","basics":{"name":"A","photo":"x"},'
            + '"experience":[{"position":"P","start":"spring 2021","end":"heute",}],"hobbies":["Chess"]}\n```',
        );

        const notices = screen.getByTestId("paste-from-ai-notices");
        expect(notices).toHaveAttribute("aria-live", "polite");
        expect(notices).toHaveTextContent("7 notes");
        expect(screen.getByTestId("paste-from-ai-notice-group-repaired")).toHaveTextContent("Took the CV out of a code block.");
        expect(screen.getByTestId("paste-from-ai-notice-group-repaired")).toHaveTextContent("Removed extra commas.");
        expect(screen.getByTestId("paste-from-ai-notice-group-skipped")).toHaveTextContent(
            "Date \"spring 2021\" could not be read and was left empty.experience[0].start");
        expect(screen.getByTestId("paste-from-ai-notice-group-skipped")).toHaveTextContent("Photos are not imported.");
        expect(screen.getByTestId("paste-from-ai-notice-group-adjusted")).toHaveTextContent("Date \"heute\" read as Present.");
        expect(screen.getByTestId("paste-from-ai-notice-group-adjusted")).toHaveTextContent("Read \"hobbies\" as \"interests\".");
        // Notes never block the import.
        expect(screen.getByTestId("paste-from-ai-import")).toBeEnabled();
    });

    it("shows the whole QA CV and creates it, then opens the editor", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const onImported = vi.fn();
        render(<PasteFromAiDialog open onClose={onClose} onImported={onImported} />);
        await paste(serializeAuthoring(resumeToAuthoring(createQaFullResume(), { ids: true, personal: true }), "pretty"));

        expect(screen.getByTestId("paste-from-ai-section-experience")).toHaveTextContent("4 entries");
        expect(screen.getByTestId("paste-from-ai-section-custom")).toHaveTextContent("3 sections");
        expect(screen.getByTestId("paste-from-ai-section-summary")).toBeInTheDocument();
        expect(await db.resumes.count()).toBe(0);

        await user.click(screen.getByTestId("paste-from-ai-import"));

        await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1));
        const saved = await db.resumes.toArray();
        expect(saved).toHaveLength(1);
        expect(saved[0].basics.name).toBe("Amina Šehić-Đurić");
        expect(saved[0].experience.map((entry) => entry.id)).toEqual(["exp-1", "exp-2", "exp-3", "exp-hidden"]);
        expect(pushMock).toHaveBeenCalledWith(`/editor/${saved[0].id}`);
        expect(onImported).toHaveBeenCalledWith(saved[0].id);
        expect(onClose).toHaveBeenCalled();
    });

    it("keeps the dialog open with Retry when saving fails, and creates nothing", async () => {
        const user = userEvent.setup();
        const persist = vi.fn().mockRejectedValueOnce(new Error("quota")).mockResolvedValueOnce("new-id");
        const onClose = vi.fn();
        vi.spyOn(console, "error").mockImplementation(() => {});
        render(<PasteFromAiDialog open onClose={onClose} persistResume={persist} />);
        await paste(SIMPLE);

        await user.click(screen.getByTestId("paste-from-ai-import"));
        expect(await screen.findByTestId("paste-from-ai-save-error")).toHaveTextContent("Nothing was created");
        expect(screen.getByTestId("paste-from-ai-import")).toHaveTextContent("Try again");
        expect(onClose).not.toHaveBeenCalled();
        expect(pushMock).not.toHaveBeenCalled();

        await user.click(screen.getByTestId("paste-from-ai-import"));
        await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/editor/new-id"));
        expect(persist).toHaveBeenCalledTimes(2);
    });

    it("hands a full EngineCV export to the existing import", async () => {
        const user = userEvent.setup();
        const onFullExport = vi.fn();
        const onClose = vi.fn();
        render(<PasteFromAiDialog open onClose={onClose} onFullExport={onFullExport} />);
        const text = JSON.stringify(createQaFullResume());
        await paste(text);

        expect(screen.getByTestId("paste-from-ai-full-export")).toHaveTextContent("complete EngineCV file");
        expect(screen.getByTestId("paste-from-ai-import")).toBeDisabled();
        await user.click(screen.getByTestId("paste-from-ai-full-export-import"));
        expect(onFullExport).toHaveBeenCalledWith(text);
        expect(onClose).toHaveBeenCalled();
    });

    it("reads pre-filled text at once", () => {
        render(<PasteFromAiDialog open onClose={vi.fn()} initialText={SIMPLE} />);
        expect(screen.getByTestId("paste-from-ai-summary")).toBeInTheDocument();
        expect(screen.getByTestId("paste-from-ai-import")).toBeEnabled();
    });

    it("copies the instructions in the UI language and says so", async () => {
        const user = userEvent.setup();
        act(() => useI18nStore.setState({ locale: "de", _hydrated: true }));
        render(<PasteFromAiDialog open onClose={vi.fn()} />);

        await user.click(screen.getByRole("button", { name: "Anleitung für deine KI kopieren" }));

        const copied = await navigator.clipboard.readText();
        expect(copied).toContain("Erfinde niemals Arbeitgeber");
        expect(copied).toContain("https://enginecv.app/schema/authoring/v1.json");
        expect(copied).toContain('"format": "enginecv.authoring/v1"');
        expect(screen.getByRole("status")).toHaveTextContent("Anleitung kopiert.");
        expect(screen.queryByTestId("paste-from-ai-copy-fallback")).not.toBeInTheDocument();
    });

    it("shows the instructions selected when the clipboard is blocked", async () => {
        const user = userEvent.setup();
        vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));
        render(<PasteFromAiDialog open onClose={vi.fn()} />);

        await user.click(screen.getByTestId("paste-from-ai-copy-instructions"));

        const fallback = await screen.findByTestId("paste-from-ai-copy-fallback");
        expect(fallback).toHaveTextContent("Copying was blocked");
        const area = fallback.querySelector("textarea")!;
        expect(area).toHaveAttribute("readonly");
        expect(area.value).toContain("Never invent employers");
        await waitFor(() => expect(area.selectionEnd - area.selectionStart).toBe(area.value.length));
    });

    it("links the published format in a new tab", () => {
        render(<PasteFromAiDialog open onClose={vi.fn()} />);
        const link = screen.getByRole("link", { name: /What format is this\?/ });
        expect(link).toHaveAttribute("href", "/schema/authoring/v1.json");
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("renders in German and Bosnian", async () => {
        act(() => useI18nStore.setState({ locale: "de", _hydrated: true }));
        const { unmount } = render(<PasteFromAiDialog open onClose={vi.fn()} initialText={'{"basics":{"name":"A"},"experience":[{"position":"P","start":"März 2021"}]}'} />);
        expect(screen.getByRole("dialog", { name: "Aus KI einfügen" })).toBeInTheDocument();
        expect(screen.getByTestId("paste-from-ai-notices")).toHaveTextContent("Datum \"März 2021\" als 2021-03 gelesen.");
        expect(screen.getByTestId("paste-from-ai-import")).toHaveTextContent("Lebenslauf erstellen");
        unmount();

        act(() => useI18nStore.setState({ locale: "bs", _hydrated: true }));
        render(<PasteFromAiDialog open onClose={vi.fn()} initialText={SIMPLE} />);
        expect(screen.getByRole("dialog", { name: "Zalijepi iz AI-ja" })).toBeInTheDocument();
        expect(screen.getByTestId("paste-from-ai-section-skills")).toHaveTextContent("Vještina: 2");
    });
});
