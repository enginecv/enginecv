import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    SOURCE_STORAGE_KEY,
    captureSource,
    normalizeSource,
    parseExportEvent,
    reportExportCompleted,
} from "./export-event";

describe("parseExportEvent", () => {
    it("accepts a known format and a clean source", () => {
        expect(parseExportEvent({ format: "pdf", source: "Reddit.com" })).toEqual({ format: "pdf", source: "reddit.com" });
    });
    it("drops unknown formats and non-objects", () => {
        expect(parseExportEvent({ format: "exe", source: "x" })).toBeNull();
        expect(parseExportEvent("pdf")).toBeNull();
        expect(parseExportEvent(null)).toBeNull();
    });
    it("buckets bad sources as other and missing ones as direct", () => {
        expect(parseExportEvent({ format: "json", source: "a b<script>" })?.source).toBe("other");
        expect(parseExportEvent({ format: "json" })?.source).toBe("direct");
        expect(parseExportEvent({ format: "json", source: "direct" })?.source).toBe("direct");
    });
});

describe("normalizeSource", () => {
    it("strips www and rejects long or odd values", () => {
        expect(normalizeSource("www.news.ycombinator.com")).toBe("news.ycombinator.com");
        expect(normalizeSource("x".repeat(41))).toBeNull();
        expect(normalizeSource("")).toBeNull();
    });
});

describe("browser side", () => {
    beforeEach(() => {
        sessionStorage.clear();
        vi.restoreAllMocks();
        window.history.replaceState(null, "", "/");
    });

    it("keeps the first source of the tab: ref beats utm_source", () => {
        window.history.replaceState(null, "", "/?ref=Reddit&utm_source=other");
        captureSource();
        expect(sessionStorage.getItem(SOURCE_STORAGE_KEY)).toBe("reddit");
        window.history.replaceState(null, "", "/?ref=later");
        captureSource();
        expect(sessionStorage.getItem(SOURCE_STORAGE_KEY)).toBe("reddit");
    });

    it("sends format and source with a beacon", () => {
        sessionStorage.setItem(SOURCE_STORAGE_KEY, "reddit");
        const beacon = vi.fn(() => true);
        Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true });
        reportExportCompleted("pdf");
        expect(beacon).toHaveBeenCalledTimes(1);
        expect((beacon.mock.calls[0] as unknown[])[0]).toBe("/api/e");
    });

    it("sends nothing when the browser asks not to be tracked", () => {
        const beacon = vi.fn(() => true);
        Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true });
        Object.defineProperty(navigator, "doNotTrack", { value: "1", configurable: true });
        reportExportCompleted("pdf");
        Object.defineProperty(navigator, "doNotTrack", { value: null, configurable: true });
        expect(beacon).not.toHaveBeenCalled();
    });
});
