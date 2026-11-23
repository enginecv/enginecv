import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    SOURCE_STORAGE_KEY,
    captureSource,
    normalizeCountry,
    normalizeLandingPath,
    normalizeSource,
    parseAffiliateClick,
    normalizeComment,
    parseExportComment,
    parseExportContext,
    parseExportEvent,
    parseExportRating,
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

describe("parseExportRating", () => {
    it("accepts up/down for a known format", () => {
        expect(parseExportRating({ event: "export_rating", rating: "up", format: "pdf", source: "Reddit.com" })).toEqual({ rating: "up", format: "pdf", source: "reddit.com" });
        expect(parseExportRating({ event: "export_rating", rating: "down", format: "docx" })?.source).toBe("direct");
    });
    it("drops other events, scores, free text and unknown formats", () => {
        expect(parseExportRating({ rating: "up", format: "pdf" })).toBeNull();
        expect(parseExportRating({ event: "export_rating", rating: 5, format: "pdf" })).toBeNull();
        expect(parseExportRating({ event: "export_rating", rating: "great cv!", format: "pdf" })).toBeNull();
        expect(parseExportRating({ event: "export_rating", rating: "up", format: "exe" })).toBeNull();
        expect(parseExportRating(null)).toBeNull();
    });
});

describe("normalizeComment", () => {
    it("collapses whitespace, caps length and drops empties", () => {
        expect(normalizeComment("  great \n  export  ")).toBe("great export");
        expect(normalizeComment("x".repeat(500))).toHaveLength(280);
        expect(normalizeComment("   ")).toBeNull();
        expect(normalizeComment(42)).toBeNull();
    });
    it("removes emails, links and long numbers people paste by mistake", () => {
        expect(normalizeComment("mail me at jane.doe@example.com thanks")).toBe("mail me at [removed] thanks");
        expect(normalizeComment("see https://example.com/me and www.me.dev")).toBe("see [removed] and [removed]");
        expect(normalizeComment("call +44 7700 900123 please")).toBe("call [removed] please");
        expect(normalizeComment("page 2 of 3, 10 jobs")).toBe("page 2 of 3, 10 jobs");
    });
});

describe("parseExportComment", () => {
    it("accepts a comment that carries a valid thumb and format", () => {
        expect(parseExportComment({ event: "export_comment", rating: "down", format: "pdf", comment: "fonts looked off" })).toEqual({
            rating: "down",
            format: "pdf",
            source: "direct",
            comment: "fonts looked off",
        });
    });
    it("drops a missing or empty comment, a bad thumb and other events", () => {
        expect(parseExportComment({ event: "export_comment", rating: "up", format: "pdf" })).toBeNull();
        expect(parseExportComment({ event: "export_comment", rating: "up", format: "pdf", comment: "  " })).toBeNull();
        expect(parseExportComment({ event: "export_comment", rating: "meh", format: "pdf", comment: "hi" })).toBeNull();
        expect(parseExportComment({ event: "export_rating", rating: "up", format: "pdf", comment: "hi" })).toBeNull();
    });
});
