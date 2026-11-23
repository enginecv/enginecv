import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useI18nStore } from "@/lib/i18n";
import { shouldAskExportRating, useExportRatingPromptStore } from "@/lib/preferences/export-support";
import { DEFAULT_CLIENT_PREFERENCES } from "@/lib/preferences/schema";
import { useClientPreferencesStore } from "@/lib/preferences/store";
import { ExportRatingCard } from "./ExportRatingCard";

describe("ExportRatingCard", () => {
    const sendBeacon = vi.fn((_url: string, _data: Blob) => true);

    /** jsdom's Blob has no text(). */
    const readBlob = (blob: Blob) =>
        new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.readAsText(blob);
        });

    beforeEach(() => {
        localStorage.clear();
        sendBeacon.mockClear();
        Object.defineProperty(navigator, "sendBeacon", { value: sendBeacon, configurable: true });
        useI18nStore.setState({ locale: "en" });
        useClientPreferencesStore.setState({ preferences: DEFAULT_CLIENT_PREFERENCES, hydrated: false });
        useExportRatingPromptStore.setState({ format: null });
    });

    afterEach(() => {
        cleanup();
        localStorage.clear();
    });

    it("renders nothing until an export milestone shows it", () => {
        render(<ExportRatingCard />);
        expect(screen.queryByTestId("export-rating-card")).toBeNull();
    });

    it("sends the thumbs answer with the format, then stops asking", () => {
        render(<ExportRatingCard />);
        act(() => useExportRatingPromptStore.getState().show("pdf"));

        fireEvent.click(screen.getByTestId("export-rating-up"));

        // Counted on the tap itself; the card then only offers the optional comment.
        expect(sendBeacon).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId("export-rating-comment")).toBeInTheDocument();
        expect(useClientPreferencesStore.getState().preferences.support.exportRatingDone).toBe(true);
    });

    it("offers an optional comment after a thumb and sends it as its own event", async () => {
        render(<ExportRatingCard />);
        act(() => useExportRatingPromptStore.getState().show("pdf"));
        fireEvent.click(screen.getByTestId("export-rating-down"));

        const box = screen.getByTestId("export-rating-comment");
        expect(box).toHaveFocus();
        expect(screen.getByTestId("export-rating-comment-send")).toBeDisabled();
        fireEvent.change(box, { target: { value: "fonts looked off" } });
        fireEvent.click(screen.getByTestId("export-rating-comment-send"));

        expect(sendBeacon).toHaveBeenCalledTimes(2);
        const bodies = await Promise.all(sendBeacon.mock.calls.map(([, blob]) => readBlob(blob)));
        expect(JSON.parse(bodies[0])).toMatchObject({ event: "export_rating", rating: "down", format: "pdf" });
        expect(JSON.parse(bodies[1])).toMatchObject({ event: "export_comment", rating: "down", format: "pdf", comment: "fonts looked off" });
        expect(screen.queryByTestId("export-rating-card")).toBeNull();
    });

    it("skipping the comment keeps the thumb and sends no second event", () => {
        render(<ExportRatingCard />);
        act(() => useExportRatingPromptStore.getState().show("pdf"));
        fireEvent.click(screen.getByTestId("export-rating-up"));
        fireEvent.click(screen.getByTestId("export-rating-comment-skip"));

        expect(sendBeacon).toHaveBeenCalledTimes(1);
        expect(screen.queryByTestId("export-rating-card")).toBeNull();
    });

    it("'Don't ask again' sends nothing and persists", () => {
        render(<ExportRatingCard />);
        act(() => useExportRatingPromptStore.getState().show("docx"));

        fireEvent.click(screen.getByTestId("export-rating-dismiss"));

        expect(sendBeacon).not.toHaveBeenCalled();
        expect(useClientPreferencesStore.getState().preferences.support.exportRatingDone).toBe(true);
    });

    it("asks only on its own milestones and not after an answer", () => {
        const setCount = (successfulExportCount: number, exportRatingDone = false) =>
            useClientPreferencesStore.setState({
                preferences: { ...DEFAULT_CLIENT_PREFERENCES, support: { ...DEFAULT_CLIENT_PREFERENCES.support, successfulExportCount, exportRatingDone } },
                hydrated: true,
            });
        setCount(1);
        expect(shouldAskExportRating()).toBe(false);
        setCount(2);
        expect(shouldAskExportRating()).toBe(true);
        setCount(2, true);
        expect(shouldAskExportRating()).toBe(false);
    });
});
