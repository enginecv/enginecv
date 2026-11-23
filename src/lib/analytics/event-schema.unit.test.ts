import { describe, expect, it } from "vitest";
import { EVENT_BLOB_LAYOUT, affiliateClickDataPoint, exportCommentDataPoint, exportCompletedDataPoint, exportRatingDataPoint } from "./event-schema";

describe("event schema", () => {
    it("writes blobs in the documented order", () => {
        const completed = exportCompletedDataPoint(
            { format: "pdf", source: "reddit.com" },
            { locale: "en", template: "default", landing: "/", role: "none", device: "desktop" },
            "de",
        );
        expect(completed.blobs).toHaveLength(EVENT_BLOB_LAYOUT.export_completed.length);
        expect(completed.blobs.slice(0, 4)).toEqual(["export_completed", "pdf", "reddit.com", "de"]);

        const click = affiliateClickDataPoint({ id: "preply", source: "direct" });
        expect(click.blobs).toHaveLength(EVENT_BLOB_LAYOUT.affiliate_click.length);

        const rating = exportRatingDataPoint({ rating: "down", format: "docx", source: "direct" }, "xx");
        expect(rating.blobs).toEqual(["export_rating", "down", "docx", "direct", "xx"]);
        expect(rating.blobs).toHaveLength(EVENT_BLOB_LAYOUT.export_rating.length);
        expect(rating.indexes).toEqual(["export_rating"]);
        expect(rating.doubles).toEqual([1]);

        const comment = exportCommentDataPoint({ rating: "up", format: "pdf", source: "direct", comment: "nice" }, "de");
        expect(comment.blobs).toEqual(["export_comment", "up", "pdf", "direct", "de", "nice"]);
        expect(comment.blobs).toHaveLength(EVENT_BLOB_LAYOUT.export_comment.length);
    });
});
