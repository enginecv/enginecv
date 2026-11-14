import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { JsonResumeImportPanel, readJsonResumeText } from "./JsonResumeImportPanel";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

const SAMPLE = {
    basics: {
        name: "Ada Example",
        label: "Software Engineer",
        email: "ada@example.com",
        profiles: [{ network: "GitHub", username: "ada", url: "https://github.com/ada" }],
    },
    work: [{ name: "Acme", position: "Engineer", startDate: "2020-03-01", summary: "Built things." }],
    education: [{ institution: "Example University", area: "Computer Science", studyType: "BSc" }],
    skills: [{ name: "Web", keywords: ["TypeScript", "React"] }],
    meta: { theme: "elegant" },
};

const file = (value: unknown) => new File([JSON.stringify(value)], "resume.json", { type: "application/json" });

describe("readJsonResumeText", () => {
    it("converts a JSON Resume document and reports what it left out", () => {
        const read = readJsonResumeText(JSON.stringify(SAMPLE));
        expect(read.ok).toBe(true);
        if (!read.ok) return;
        expect(read.result.resume.basics.name).toBe("Ada Example");
        expect(read.result.counts.experience).toBe(1);
        expect(read.result.report.items.some((item) => item.code === "theme-left-out")).toBe(true);
    });

    it("tells apart text that is not JSON, JSON of another shape and an oversized file", () => {
        expect(readJsonResumeText("{ not json")).toEqual({ ok: false, failure: "not-json" });
        expect(readJsonResumeText(JSON.stringify({ hello: "world" }))).toEqual({ ok: false, failure: "not-json-resume" });
        expect(readJsonResumeText(JSON.stringify([1, 2]))).toEqual({ ok: false, failure: "not-json-resume" });
        expect(readJsonResumeText(" ".repeat(2 * 1024 * 1024 + 1))).toEqual({ ok: false, failure: "too-large" });
    });
});

describe("JsonResumeImportPanel", () => {
    beforeEach(() => useI18nStore.setState({ locale: "en", _hydrated: true }));
    afterEach(cleanup);

    it("renders labelled by the page heading with the drop zone and paste box", () => {
        render(
            <>
                <h1 id="page-title">Edit your JSON Resume</h1>
                <JsonResumeImportPanel onDone={vi.fn()} labelledBy="page-title" />
            </>,
        );

        expect(screen.getByRole("region", { name: "Edit your JSON Resume" })).toBeInTheDocument();
        expect(screen.getByTestId("json-resume-drop-zone")).toBeInTheDocument();
        expect(screen.getByLabelText("Or paste the JSON text")).toBeInTheDocument();
    });

    it("previews the sections and the loss list for a dropped file, then saves on confirm", async () => {
        const user = userEvent.setup({ applyAccept: false });
        const onDone = vi.fn();
        const persistResume = vi.fn().mockResolvedValue("resume-1");
        render(<JsonResumeImportPanel onDone={onDone} persistResume={persistResume} />);

        await user.upload(screen.getByTestId("json-resume-file-input") as HTMLInputElement, file(SAMPLE));

        expect(await screen.findByTestId("json-resume-preview-name")).toHaveTextContent("Ada Example");
        expect(screen.getByTestId("json-resume-preview-section-experience")).toHaveTextContent("1 entry");
        expect(screen.getByTestId("json-resume-preview-section-skills")).toBeInTheDocument();
        expect(persistResume).not.toHaveBeenCalled();

        await user.click(screen.getByTestId("json-resume-confirm"));

        await waitFor(() => expect(onDone).toHaveBeenCalledWith("resume-1"));
        expect(persistResume.mock.calls[0][0].basics.name).toBe("Ada Example");
    });

    it("reads pasted text", async () => {
        const user = userEvent.setup();
        render(<JsonResumeImportPanel onDone={vi.fn()} persistResume={vi.fn()} />);

        expect(screen.getByTestId("json-resume-paste-submit")).toBeDisabled();
        await user.click(screen.getByTestId("json-resume-paste"));
        await user.paste(JSON.stringify(SAMPLE));
        await user.click(screen.getByTestId("json-resume-paste-submit"));

        expect(await screen.findByTestId("json-resume-preview-name")).toHaveTextContent("Ada Example");
    });

    it("goes back to the drop zone on cancel", async () => {
        const user = userEvent.setup({ applyAccept: false });
        render(<JsonResumeImportPanel onDone={vi.fn()} persistResume={vi.fn()} />);

        await user.upload(screen.getByTestId("json-resume-file-input") as HTMLInputElement, file(SAMPLE));
        await user.click(await screen.findByTestId("json-resume-cancel"));

        expect(screen.getByTestId("json-resume-drop-zone")).toBeInTheDocument();
    });

    it("explains a file that is JSON but not a JSON Resume, and lets the person retry", async () => {
        const user = userEvent.setup({ applyAccept: false });
        const persistResume = vi.fn();
        render(<JsonResumeImportPanel onDone={vi.fn()} persistResume={persistResume} />);

        await user.upload(screen.getByTestId("json-resume-file-input") as HTMLInputElement, file({ hello: "world" }));

        expect(await screen.findByTestId("json-resume-error")).toHaveTextContent("does not look like a JSON Resume file");
        expect(persistResume).not.toHaveBeenCalled();
        await user.click(screen.getByTestId("json-resume-retry"));
        expect(screen.getByTestId("json-resume-drop-zone")).toBeInTheDocument();
    });

    it("shows an error when saving fails and keeps nothing saved", async () => {
        const user = userEvent.setup({ applyAccept: false });
        const onDone = vi.fn();
        render(<JsonResumeImportPanel onDone={onDone} persistResume={vi.fn().mockRejectedValue(new Error("quota"))} />);

        await user.upload(screen.getByTestId("json-resume-file-input") as HTMLInputElement, file(SAMPLE));
        await user.click(await screen.findByTestId("json-resume-confirm"));

        expect(await screen.findByTestId("json-resume-error")).toHaveTextContent("could not be saved");
        expect(onDone).not.toHaveBeenCalled();
    });
});
