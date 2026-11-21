import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { useNotices } from "@/lib/workspace/notices";

const undoActivity = vi.fn(async () => ({ ok: true as const }));
vi.mock("@/lib/workspace/activity", () => ({ undoActivity: (...args: unknown[]) => undoActivity(...(args as [])) }));

import { AgentNotices, NOTICE_MS } from "./AgentNotices";

const push = (notice: Parameters<ReturnType<typeof useNotices.getState>["push"]>[0]) => act(() => useNotices.getState().push(notice));

describe("AgentNotices", () => {
    beforeEach(() => {
        act(() => { useI18nStore.setState({ locale: "en", _hydrated: true }); useNotices.getState().clear(); });
        undoActivity.mockClear();
    });
    afterEach(() => { cleanup(); vi.useRealTimers(); });

    it("names the agent that signed its work and links to what it made", () => {
        render(<AgentNotices />);
        push({ kind: "created", docId: "cv-1", docKind: "cv", title: "Specialised Resume", agent: "Claude Code" });
        expect(screen.getByTestId("agent-notice-text")).toHaveTextContent("Claude Code created a new CV: Specialised Resume");
        expect(screen.getByTestId("agent-notice-open")).toHaveAttribute("href", "/editor/cv-1");
    });

    it("does not guess a name when the file was not signed, and links letters to the letter page", () => {
        render(<AgentNotices />);
        push({ kind: "created", docId: "l-1", docKind: "letter", title: "Acme", agent: null });
        expect(screen.getByTestId("agent-notice-text")).toHaveTextContent("A new cover letter was added from a file: Acme");
        expect(screen.getByTestId("agent-notice-open")).toHaveAttribute("href", "/letters/l-1");
    });

    it("shows what an edit changed, groups repeats, and undoes from the activity list", async () => {
        render(<AgentNotices />);
        push({ kind: "edited", docId: "cv-1", docKind: "cv", title: "Master", agent: "Codex", added: 1, changed: 2, activityId: 7 });
        expect(screen.getByTestId("agent-notice-text")).toHaveTextContent("Codex edited Master (+1 −0 ~2)");
        push({ kind: "edited", docId: "cv-1", docKind: "cv", title: "Master", agent: "Codex", removed: 4, activityId: 8 });
        expect(screen.getAllByTestId("agent-notice-edited")).toHaveLength(1);
        expect(screen.getByTestId("agent-notice-text")).toHaveTextContent("2 edits: +1 −4 ~2");
        fireEvent.click(screen.getByTestId("agent-notice-undo"));
        await waitFor(() => expect(undoActivity).toHaveBeenCalledWith(8));
        await waitFor(() => expect(screen.queryByTestId("agent-notice-edited")).toBeNull());
    });

    it("keeps a refusal on screen with its reason until it is dismissed, and ordinary ones go away on their own", () => {
        vi.useFakeTimers();
        render(<AgentNotices />);
        push({ kind: "refused", docId: "cv-1", docKind: "cv", title: "Master", code: "invalid-json" });
        push({ kind: "exported", docId: "cv-1", docKind: "cv", title: "Master", agent: "Claude Code", format: "html" });
        expect(screen.getByTestId("agent-notice-refused")).toHaveTextContent("A change to Master was refused");
        expect(screen.getByTestId("agent-notice-exported")).toHaveTextContent("Claude Code exported Master as html");
        act(() => { vi.advanceTimersByTime(NOTICE_MS + 100); });
        expect(screen.queryByTestId("agent-notice-exported")).toBeNull();
        expect(screen.getByTestId("agent-notice-refused")).toBeInTheDocument();
        fireEvent.click(screen.getByTestId("agent-notice-dismiss"));
        expect(screen.queryByTestId("agent-notice-refused")).toBeNull();
    });

    it("renders in German", () => {
        act(() => useI18nStore.setState({ locale: "de", _hydrated: true }));
        render(<AgentNotices />);
        push({ kind: "created", docId: "cv-1", docKind: "cv", title: "Master", agent: "Claude Code" });
        expect(screen.getByTestId("agent-notice-text")).toHaveTextContent("Claude Code hat einen neuen Lebenslauf erstellt: Master");
        expect(document.body.textContent).not.toMatch(/workspace\.notice\./);
    });
});
