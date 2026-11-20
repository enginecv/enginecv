import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { createEmptyResume } from "@/lib/schema";
import { SKILL_URL } from "@/lib/agent/authoring/skill-urls";
import { AgentHelp } from "./AgentHelp";
import { CopyForAiPanel } from "./CopyForAiPanel";

beforeEach(() => act(() => useI18nStore.setState({ locale: "en", _hydrated: true })));
afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    delete (window as { showDirectoryPicker?: unknown }).showDirectoryPicker;
});

function mockClipboard(writeText: (text: string) => Promise<void>) {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
}

describe("AgentHelp", () => {
    it("shows the three steps and the install address", () => {
        render(<AgentHelp />);
        expect(screen.getByText("1. Connect a folder")).toBeInTheDocument();
        expect(screen.getByText("2. Tell your agent")).toBeInTheDocument();
        expect(screen.getByText("3. See the result")).toBeInTheDocument();
        expect(screen.getByText(SKILL_URL)).toBeInTheDocument();
    });

    it("copies the install address and the starter prompt", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        mockClipboard(writeText);
        render(<AgentHelp />);
        fireEvent.click(screen.getByTestId("agent-help-copy-install"));
        await waitFor(() => expect(writeText).toHaveBeenCalledWith(SKILL_URL));
        fireEvent.click(screen.getByTestId("agent-help-copy-prompt"));
        await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
        expect(writeText.mock.calls[1][0]).toContain(SKILL_URL);
        expect(writeText.mock.calls[1][0]).toContain("AGENTS.md");
        expect(await screen.findByTestId("agent-help-status")).toHaveTextContent("Copied");
    });

    it("falls back to selectable text when the clipboard is denied", async () => {
        mockClipboard(vi.fn().mockRejectedValue(Object.assign(new Error("no"), { name: "NotAllowedError" })));
        render(<AgentHelp />);
        fireEvent.click(screen.getByTestId("agent-help-copy-prompt"));
        const fallback = await screen.findByTestId("agent-help-fallback");
        expect(fallback.querySelector("textarea")?.value).toContain(SKILL_URL);
    });

    it("says so on browsers without folder access, and not on Chromium", () => {
        const { unmount } = render(<AgentHelp />);
        expect(screen.getByTestId("agent-help-no-folder")).toBeInTheDocument();
        unmount();
        window.showDirectoryPicker = vi.fn();
        render(<AgentHelp />);
        expect(screen.queryByTestId("agent-help-no-folder")).not.toBeInTheDocument();
    });

    it("renders in German", async () => {
        act(() => useI18nStore.setState({ locale: "de", _hydrated: true }));
        render(<AgentHelp />);
        expect(await screen.findByText("1. Ordner verbinden")).toBeInTheDocument();
        expect(screen.getByText("Skill-Adresse kopieren")).toBeInTheDocument();
    });
});

describe("CopyForAiPanel agent help link", () => {
    it("opens the help from the panel", () => {
        render(<CopyForAiPanel resume={createEmptyResume()} />);
        const toggle = screen.getByTestId("export-agent-help-toggle");
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByTestId("agent-help")).toBeInTheDocument();
    });
});
