import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    SOURCE_STORAGE_KEY,
    captureSource,
    normalizeCountry,
    normalizeLandingPath,
    normalizeSource,
    parseAffiliateClick,
    parseExportContext,
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

describe("parseAffiliateClick", () => {
    it("accepts a link id with a source", () => {
        expect(parseAffiliateClick({ event: "affiliate_click", id: "preply", source: "reddit.com" })).toEqual({ id: "preply", source: "reddit.com" });
        expect(parseAffiliateClick({ event: "affiliate_click", id: "preply" })?.source).toBe("direct");
    });
    it("drops other events and odd ids", () => {
        expect(parseAffiliateClick({ id: "preply" })).toBeNull();
        expect(parseAffiliateClick({ event: "affiliate_click", id: "Bad Id!" })).toBeNull();
        expect(parseAffiliateClick({ event: "affiliate_click", id: 5 })).toBeNull();
    });
});

describe("normalizeSource", () => {
    it("strips www and rejects long or odd values", () => {
        expect(normalizeSource("www.news.ycombinator.com")).toBe("news.ycombinator.com");
        expect(normalizeSource("x".repeat(41))).toBeNull();
        expect(normalizeSource("")).toBeNull();
    });
});

describe("normalizeLandingPath", () => {
    it("drops the locale prefix, query and hash", () => {
        expect(normalizeLandingPath("/de/cv-examples/nurse?utm=x#top")).toBe("/cv-examples/nurse");
        expect(normalizeLandingPath("/")).toBe("/");
        expect(normalizeLandingPath("/de")).toBe("/");
    });
    it("never keeps a private id", () => {
        expect(normalizeLandingPath("/editor/3f9a-secret-id")).toBe("/editor");
        expect(normalizeLandingPath("/dashboard/abc")).toBe("/dashboard");
    });
    it("rejects deep or odd paths", () => {
        expect(normalizeLandingPath("/a/b/c")).toBeNull();
        expect(normalizeLandingPath("/blog/a b<script>")).toBeNull();
        expect(normalizeLandingPath(5)).toBeNull();
    });
});

describe("parseExportContext", () => {
    it("keeps clean tokens and derives the role from the landing page", () => {
        expect(parseExportContext({ locale: "de", template: "modern", landing: "/cv-examples/nurse", device: "mobile" })).toEqual({
            locale: "de",
            template: "modern",
            landing: "/cv-examples/nurse",
            role: "nurse",
            device: "mobile",
        });
    });
    it("buckets anything else", () => {
        expect(parseExportContext({ locale: "xx", template: "My Name!", landing: "/a/b/c", device: "tv" })).toEqual({
            locale: "other",
            template: "other",
            landing: "other",
            role: "none",
            device: "unknown",
        });
        expect(parseExportContext({})).toEqual({ locale: "other", template: "default", landing: "unknown", role: "none", device: "unknown" });
    });
});

describe("normalizeCountry", () => {
    it("accepts two capitals and lowercases them", () => {
        expect(normalizeCountry("DE")).toBe("de");
        expect(normalizeCountry("Germany")).toBe("xx");
        expect(normalizeCountry(undefined)).toBe("xx");
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
