import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import { ExportModuleLoadError } from "@/lib/resume-export";
import { createEmptyResume } from "@/lib/schema";
import { getKofiUrl } from "@/lib/support";
import { ExportDialog } from "./ExportMenu";
import { authoringToResume, parseAuthoringText, resumeToAuthoring, serializeAuthoring } from "@/lib/agent/authoring";
import { createQaFullResume } from "@/lib/qa/sample-resumes";

const mocks = vi.hoisted(() => ({
    deliverFile: vi.fn(),
    runOverride: null as null | ((...args: unknown[]) => Promise<unknown>),
}));

vi.mock("@/lib/share", () => ({ deliverFile: mocks.deliverFile }));

vi.mock("@/lib/resume-export", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/resume-export")>();
    return {
        ...actual,
        loadDocxExporter: () => Promise.resolve({}),
        runResumeExport: (...args: Parameters<typeof actual.runResumeExport>) =>
            mocks.runOverride ? mocks.runOverride(...args) : actual.runResumeExport(...args),
    };
});

function sampleResume() {
    const resume = createEmptyResume();
    resume.basics.name = "Ada Lovelace";
    resume.basics.summary = "Wrote the **first** program.";
    return resume;
}

function renderDialog(onClose = vi.fn()) {
    render(<ExportDialog open onClose={onClose} resume={sampleResume()} paperSize="a4" />);
    return onClose;
}

async function blobText(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsText(blob);
    });
}

function mockMatchMedia(matches: (query: string) => boolean) {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            matches: matches(query),
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
}

describe("ExportDialog", () => {
    afterEach(() => {
        cleanup();
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("offers optional Ko-fi support without blocking export", () => {
        mockMatchMedia(() => false);

        render(
            <ExportDialog
                open
                onClose={vi.fn()}
                resume={createEmptyResume()}
                paperSize="a4"
            />,
        );

        expect(screen.getByRole("link", { name: "Support EngineCV on Ko-fi" })).toHaveAttribute(
            "href",
            getKofiUrl("export-dialog"),
        );
        expect(screen.getByRole("link", { name: "Support EngineCV on Ko-fi" })).toHaveAttribute(
            "target",
            "_blank",
        );
        expect(screen.getByTestId("export-confirm-button")).toBeEnabled();
    });

    it("blocks mobile PDF export while keeping JSON export available", async () => {
        mockMatchMedia((query) => query === "(pointer: coarse)" || query === "(max-width: 1023px)");

        render(
            <ExportDialog
                open
                onClose={vi.fn()}
                resume={createEmptyResume()}
                paperSize="a4"
            />,
        );

        expect(await screen.findByTestId("export-mobile-pdf-warning")).toHaveTextContent(
            "Mobile PDF export is not supported",
        );
        expect(screen.getByTestId("export-confirm-button")).toBeDisabled();

        fireEvent.click(screen.getByTestId("export-format-json"));

        await waitFor(() => {
            expect(screen.queryByTestId("export-mobile-pdf-warning")).not.toBeInTheDocument();
        });
        expect(screen.getByTestId("export-confirm-button")).not.toBeDisabled();
    });
});

describe("ExportDialog new formats", () => {
    beforeEach(() => {
        mockMatchMedia(() => false);
        mocks.deliverFile.mockReset().mockResolvedValue("download");
        mocks.runOverride = null;
        useClientPreferencesStore.getState().updateSection("export", { format: "pdf", pdfIncludeSidecar: false, docxIncludePhoto: false });
    });

    afterEach(() => {
        cleanup();
        act(() => useI18nStore.setState({ locale: "en" }));
        vi.unstubAllGlobals();
    });

    it("lists every registry format and hides encryption for formats without it", () => {
        renderDialog();
        for (const id of ["json", "pdf", "docx", "md", "txt", "html", "png", "svg"]) {
            expect(screen.getByTestId(`export-format-${id}`)).toBeInTheDocument();
        }
        fireEvent.click(screen.getByTestId("export-format-json"));
        expect(screen.getByRole("switch", { name: /Encrypt/i })).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("export-format-md"));
        expect(screen.queryByRole("switch", { name: /Encrypt/i })).not.toBeInTheDocument();
    });

    it("delivers Markdown and plain text files", async () => {
        const onClose = renderDialog();

        fireEvent.click(screen.getByTestId("export-format-md"));
        fireEvent.click(screen.getByTestId("export-confirm-button"));
        await waitFor(() => expect(mocks.deliverFile).toHaveBeenCalledTimes(1));
        const [mdBlob, mdName] = mocks.deliverFile.mock.calls[0];
        expect(mdName).toBe("resume-ada-lovelace.md");
        expect(await blobText(mdBlob)).toContain("# Ada Lovelace");
        await waitFor(() => expect(onClose).toHaveBeenCalled());

        cleanup();
        renderDialog();
        fireEvent.click(screen.getByTestId("export-format-txt"));
        fireEvent.click(screen.getByTestId("export-confirm-button"));
        await waitFor(() => expect(mocks.deliverFile).toHaveBeenCalledTimes(2));
        const [txtBlob, txtName] = mocks.deliverFile.mock.calls[1];
        expect(txtName).toBe("resume-ada-lovelace.txt");
        const text = await blobText(txtBlob);
        expect(text).toContain("Wrote the first program.");
        expect(text).not.toContain("**");
    });

    it("shows the photo option only for DOCX and remembers it", async () => {
        renderDialog();
        expect(screen.queryByTestId("export-docx-include-photo")).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId("export-format-docx"));
        const toggle = screen.getByTestId("export-docx-include-photo");
        expect(toggle).toHaveAttribute("aria-checked", "false");
        fireEvent.click(toggle);

        const run = vi.fn().mockResolvedValue({ notices: [] });
        mocks.runOverride = run;
        fireEvent.click(screen.getByTestId("export-confirm-button"));
        await waitFor(() => expect(run).toHaveBeenCalled());
        expect(run.mock.calls[0][0]).toMatchObject({ format: "docx", docxIncludePhoto: true });
        await waitFor(() => expect(useClientPreferencesStore.getState().preferences.export.docxIncludePhoto).toBe(true));

        cleanup();
        renderDialog();
        expect(screen.getByTestId("export-docx-include-photo")).toHaveAttribute("aria-checked", "true");
    });

    it("keeps the dialog open with a notice when the photo was skipped", async () => {
        mocks.runOverride = vi.fn().mockResolvedValue({ notices: ["docxPhotoSkipped"] });
        const onClose = renderDialog();
        fireEvent.click(screen.getByTestId("export-format-docx"));
        fireEvent.click(screen.getByTestId("export-confirm-button"));
        expect(await screen.findByTestId("export-docx-photo-skipped")).toHaveTextContent("Photo left out");
        expect(onClose).not.toHaveBeenCalled();
    });

    it("explains a failed DOCX load and allows retry", async () => {
        mocks.runOverride = vi.fn()
            .mockRejectedValueOnce(new ExportModuleLoadError())
            .mockResolvedValueOnce({ notices: [] });
        const onClose = renderDialog();
        fireEvent.click(screen.getByTestId("export-format-docx"));
        fireEvent.click(screen.getByTestId("export-confirm-button"));
        expect(await screen.findByText(/Word exporter couldn't load/)).toBeInTheDocument();
        await waitFor(() => expect(screen.getByTestId("export-confirm-button")).toBeEnabled());
        fireEvent.click(screen.getByTestId("export-confirm-button"));
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it("offers a copy button only on the Text, Markdown and HTML tabs", () => {
        renderDialog();
        for (const id of ["pdf", "json", "docx", "png", "svg"]) {
            fireEvent.click(screen.getByTestId(`export-format-${id}`));
            expect(screen.queryByTestId("export-copy-clipboard"), id).not.toBeInTheDocument();
        }
        fireEvent.click(screen.getByTestId("export-format-txt"));
        expect(screen.getByTestId("export-copy-clipboard")).toHaveTextContent("Copy Text");
        fireEvent.click(screen.getByTestId("export-format-md"));
        expect(screen.getByTestId("export-copy-clipboard")).toHaveTextContent("Copy Markdown");
        fireEvent.click(screen.getByTestId("export-format-html"));
        expect(screen.getByTestId("export-copy-clipboard")).toHaveTextContent("Copy HTML");
    });

    it("copies the standalone HTML document from the HTML tab", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
        const page = document.createElement("div");
        page.className = "resume-page";
        page.textContent = "Rendered Ada page";
        document.body.appendChild(page);

        try {
            renderDialog();
            fireEvent.click(screen.getByTestId("export-format-html"));
            fireEvent.click(screen.getByTestId("export-copy-clipboard"));
            expect(await screen.findByText("Resume copied to clipboard")).toBeInTheDocument();
            const copied = writeText.mock.calls[0][0];
            expect(copied).toMatch(/^<!DOCTYPE html>/i);
            expect(copied).toContain("Rendered Ada page");
            expect(copied).toContain("<title>resume-ada-lovelace.html</title>");
        } finally {
            page.remove();
        }
    });

    it("reports a failed HTML copy when no preview pages are mounted", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
        vi.spyOn(console, "error").mockImplementation(() => undefined);

        renderDialog();
        fireEvent.click(screen.getByTestId("export-format-html"));
        fireEvent.click(screen.getByTestId("export-copy-clipboard"));
        // The dialog first waits for the preview to mount, then gives up.
        expect(await screen.findByText("Export failed.", undefined, { timeout: 7_000 })).toBeInTheDocument();
        expect(writeText).not.toHaveBeenCalled();
    }, 10_000);

    it("asks for the preview when HTML is picked and copies once its pages mount", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
        const page = document.createElement("div");
        page.className = "resume-page";
        page.textContent = "Mounted preview page";
        const onNeedPreview = vi.fn(() => {
            setTimeout(() => document.body.appendChild(page), 100);
        });

        try {
            render(<ExportDialog open onClose={vi.fn()} resume={sampleResume()} paperSize="a4" onNeedPreview={onNeedPreview} />);
            fireEvent.click(screen.getByTestId("export-format-html"));
            expect(onNeedPreview).toHaveBeenCalledTimes(1);

            fireEvent.click(screen.getByTestId("export-copy-clipboard"));
            expect(await screen.findByText("Resume copied to clipboard")).toBeInTheDocument();
            expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Mounted preview page"));
        } finally {
            page.remove();
        }
    });

    it("copies plain text from the Text tab and reports denial", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

        renderDialog();
        fireEvent.click(screen.getByTestId("export-format-txt"));
        fireEvent.click(screen.getByTestId("export-copy-clipboard"));
        expect(await screen.findByText("Resume copied to clipboard")).toBeInTheDocument();
        expect(writeText.mock.calls[0][0]).toContain("Wrote the first program.");
        expect(writeText.mock.calls[0][0]).not.toContain("**");
        expect(mocks.deliverFile).not.toHaveBeenCalled();

        const denied = new Error("denied");
        denied.name = "NotAllowedError";
        writeText.mockRejectedValueOnce(denied);
        cleanup();
        renderDialog();
        fireEvent.click(screen.getByTestId("export-format-txt"));
        fireEvent.click(screen.getByTestId("export-copy-clipboard"));
        expect(await screen.findByText(/Couldn't copy to the clipboard/)).toBeInTheDocument();
    });

    it("copies Markdown source from the Markdown tab", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

        renderDialog();
        fireEvent.click(screen.getByTestId("export-format-md"));
        fireEvent.click(screen.getByTestId("export-copy-clipboard"));
        expect(await screen.findByText("Resume copied to clipboard")).toBeInTheDocument();
        const copied = writeText.mock.calls[0][0];
        expect(copied).toContain("# Ada Lovelace");
        expect(copied).toContain("**first**");
    });

    it("renders new copy in Bosnian", () => {
        act(() => useI18nStore.setState({ locale: "bs" }));
        renderDialog();
        fireEvent.click(screen.getByTestId("export-format-docx"));
        expect(screen.getByText("Uključi fotografiju")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("export-format-txt"));
        expect(screen.getByTestId("export-copy-clipboard")).toHaveTextContent("Kopiraj Tekst");
    });
});

describe("ExportDialog — Copy for AI (US4)", () => {
    afterEach(() => {
        cleanup();
        localStorage.clear();
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        act(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
    });

    async function copyForAi(resume = createQaFullResume()) {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
        render(<ExportDialog open onClose={vi.fn()} resume={resume} paperSize="a4" />);
        await screen.findByTestId("export-copy-for-ai-button");
        return writeText;
    }

    it("copies the CV in the authoring format, without ids or sensitive details", async () => {
        const resume = createQaFullResume();
        const writeText = await copyForAi(resume);

        fireEvent.click(screen.getByTestId("export-copy-for-ai-button"));

        await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
        const text = writeText.mock.calls[0][0] as string;
        expect(text).toBe(serializeAuthoring(resumeToAuthoring(resume, { ids: false, personal: false }), "pretty"));
        expect(text).toContain("\"format\": \"enginecv.authoring/v1\"");
        expect(text).not.toContain("1990-04-12");
        expect(text).not.toContain("A1234567");
        expect(text).not.toContain("\"exp-1\"");
        await waitFor(() => expect(screen.getByTestId("export-copy-for-ai-status")).toHaveTextContent("CV copied for your AI."));
        expect(screen.getByTestId("export-copy-for-ai-button")).toHaveTextContent("Copied");
    });

    it("adds date of birth and ID numbers only when asked", async () => {
        const writeText = await copyForAi();
        const checkbox = screen.getByRole("checkbox", { name: /Include personal details/ });
        expect(checkbox).not.toBeChecked();

        fireEvent.click(checkbox);
        fireEvent.click(screen.getByTestId("export-copy-for-ai-button"));

        await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
        const text = writeText.mock.calls[0][0] as string;
        expect(text).toContain("\"dateOfBirth\": \"1990-04-12\"");
        expect(text).toContain("\"passport\": \"A1234567\"");
    });

    it("shows the text selected when the clipboard is blocked", async () => {
        const writeText = await copyForAi();
        writeText.mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));

        fireEvent.click(screen.getByTestId("export-copy-for-ai-button"));

        const fallback = await screen.findByTestId("export-copy-for-ai-fallback");
        expect(fallback).toHaveTextContent("Copying was blocked");
        const area = fallback.querySelector("textarea")!;
        expect(area.value).toContain("enginecv.authoring/v1");
        await waitFor(() => expect(area.selectionEnd - area.selectionStart).toBe(area.value.length));
    });

    it("pastes back into the same content", async () => {
        const resume = createQaFullResume();
        const writeText = await copyForAi(resume);
        fireEvent.click(screen.getByTestId("export-copy-for-ai-button"));
        await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));

        const parsed = parseAuthoringText(writeText.mock.calls[0][0] as string);
        const back = authoringToResume(parsed.document).resume;
        expect(back.experience.map((entry) => entry.company)).toEqual(resume.experience.map((entry) => entry.company));
        expect(back.languages.map((entry) => entry.fluency)).toEqual(resume.languages.map((entry) => entry.fluency));
        expect(back.basics.dateOfBirth).toBe("");
    });

    it("renders in German", async () => {
        act(() => useI18nStore.setState({ locale: "de", _hydrated: true }));
        render(<ExportDialog open onClose={vi.fn()} resume={createQaFullResume()} paperSize="a4" />);
        expect(await screen.findByTestId("export-copy-for-ai")).toHaveTextContent("Für KI kopieren");
        expect(screen.getByRole("checkbox", { name: /Persönliche Angaben einschließen/ })).toBeInTheDocument();
    });
});
