import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { strFromU8, unzipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { README_REFERRAL_URL } from "@/lib/github-readme/markdown";
import { README_FILES } from "@/lib/github-readme/package";
import { createQaFullResume } from "@/lib/qa/sample-resumes";
import { createEmptyResume } from "@/lib/schema";
import { ExportDialog } from "./ExportMenu";

const mocks = vi.hoisted(() => ({ deliverFile: vi.fn() }));

vi.mock("@/lib/share", () => ({ deliverFile: mocks.deliverFile }));

function sampleResume(name = "Ada Lovelace") {
    const resume = createEmptyResume();
    resume.basics.name = name;
    resume.basics.headline = "Analyst";
    resume.basics.email = "ada@example.com";
    resume.basics.github = "github.com/ada";
    return resume;
}

function openReadme(resume = sampleResume(), onClose = vi.fn()) {
    render(<ExportDialog open onClose={onClose} resume={resume} paperSize="a4" />);
    fireEvent.click(screen.getByTestId("export-github-readme"));
    return onClose;
}

function preview(): string {
    return (screen.getByTestId("github-readme-preview") as HTMLTextAreaElement).value;
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
        reader.readAsArrayBuffer(blob);
    });
}

describe("GithubReadmeDialog", () => {
    beforeEach(() => {
        mocks.deliverFile.mockReset().mockResolvedValue("download");
    });

    afterEach(() => {
        cleanup();
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it("opens from the export dialog with a live preview and safe defaults", () => {
        openReadme();
        expect(screen.getByTestId("github-readme-dialog")).toBeInTheDocument();
        expect(preview()).toContain("# Ada Lovelace");
        expect(preview()).toContain("[GitHub](https://github.com/ada)");
        expect(preview()).not.toContain("mailto:");
        expect(preview()).not.toContain(README_REFERRAL_URL);
    });

    it("renders the README Markdown by default", () => {
        openReadme(createQaFullResume());
        const rendered = screen.getByTestId("github-readme-rendered");
        expect(rendered.querySelector("h1")).toHaveTextContent(createQaFullResume().basics.name);
        expect(rendered.querySelector("img[src^='https://img.shields.io/badge/']")).toBeInTheDocument();
        expect(screen.getByTestId("github-readme-preview")).not.toBeVisible();
    });

    it("switches between the rendered view and the Markdown source", () => {
        openReadme();
        fireEvent.click(screen.getByTestId("github-readme-view-source"));
        expect(screen.queryByTestId("github-readme-rendered")).not.toBeInTheDocument();
        expect(screen.getByTestId("github-readme-preview")).toBeVisible();
        fireEvent.click(screen.getByTestId("github-readme-view-rendered"));
        expect(screen.getByTestId("github-readme-rendered")).toBeInTheDocument();
    });

    it("updates the preview when options change", () => {
        openReadme();
        fireEvent.click(screen.getByTestId("github-readme-section-headline"));
        // The card's alt text still names the headline; the paragraph is gone.
        expect(preview()).not.toMatch(/^Analyst$/m);
        fireEvent.click(screen.getByTestId("github-readme-contact"));
        expect(preview()).toContain("mailto:ada@example.com");
        fireEvent.click(screen.getByTestId("github-readme-card"));
        expect(preview()).not.toContain("<picture>");
    });

    it("copies exactly the previewed Markdown", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
        openReadme();
        fireEvent.click(screen.getByTestId("github-readme-full-cv"));
        fireEvent.click(screen.getByTestId("github-readme-copy"));
        await waitFor(() => expect(writeText).toHaveBeenCalledWith(preview()));
        expect(await screen.findByText("Copied")).toBeInTheDocument();
    });

    it("shows a manual-copy fallback when the clipboard is blocked", async () => {
        const denied = Object.assign(new Error("denied"), { name: "NotAllowedError" });
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(denied) } });
        openReadme();
        fireEvent.click(screen.getByTestId("github-readme-copy"));
        expect(await screen.findByTestId("github-readme-error")).toHaveTextContent("Select the text in the preview");
        expect(screen.getByTestId("github-readme-preview")).toBeVisible();
    });

    it("downloads a package whose files match the snippet", async () => {
        openReadme();
        fireEvent.click(screen.getByTestId("github-readme-package"));
        await waitFor(() => expect(mocks.deliverFile).toHaveBeenCalledTimes(1));
        const [blob, filename] = mocks.deliverFile.mock.calls[0] as [Blob, string];
        expect(filename).toBe("github-readme-ada-lovelace.zip");
        const files = unzipSync(await blobBytes(blob));
        expect(Object.keys(files).sort()).toEqual([README_FILES.markdown, README_FILES.cardDark, README_FILES.cardLight].sort());
        expect(strFromU8(files[README_FILES.markdown])).toBe(preview());
    });

    it("reports a failed download", async () => {
        mocks.deliverFile.mockRejectedValue(new Error("nope"));
        openReadme();
        fireEvent.click(screen.getByTestId("github-readme-card-dark"));
        expect(await screen.findByTestId("github-readme-error")).toHaveTextContent("The download failed");
    });

    it("remembers the EngineCV line but resets other options", () => {
        const onClose = openReadme();
        fireEvent.click(screen.getByTestId("github-readme-credit"));
        fireEvent.click(screen.getByTestId("github-readme-contact"));
        expect(preview()).toContain(README_REFERRAL_URL);
        cleanup();

        openReadme(sampleResume(), onClose);
        expect(screen.getByTestId("github-readme-credit")).toHaveAttribute("aria-checked", "true");
        expect(preview()).toContain(README_REFERRAL_URL);
        expect(preview()).not.toContain("mailto:");
    });

    it("explains and disables actions when the resume has no name", () => {
        openReadme(sampleResume(""));
        expect(screen.getByTestId("github-readme-missing-name")).toBeInTheDocument();
        for (const id of ["copy", "package", "card-light", "card-dark"]) {
            expect(screen.getByTestId(`github-readme-${id}`)).toBeDisabled();
        }
    });

    it("goes back to the formats and closes on Escape", async () => {
        const onClose = openReadme();
        fireEvent.click(screen.getByTestId("github-readme-back"));
        expect(screen.getByTestId("export-github-readme")).toBeInTheDocument();

        fireEvent.click(screen.getByTestId("export-github-readme"));
        fireEvent.keyDown(document, { key: "Escape" });
        await waitFor(() => expect(onClose).toHaveBeenCalled());
    });
});
