import type { AffiliateClick, ExportComment, ExportContext, ExportEvent, ExportRating } from "./export-event";

/**
 * The single source of truth for what each Workers Analytics Engine column means.
 * Analytics Engine only offers generic `blob1..blobN` / `double1` columns, so the
 * meaning lives here (and in docs/analytics.md). Always filter on `blob1` (or
 * `index1`) first: the same column holds different things per event type.
 * Add new fields at the END of a layout so old rows keep their meaning.
 */
export const EVENT_BLOB_LAYOUT = {
    export_completed: ["event", "format", "source", "country", "locale", "template", "landing", "role", "device"],
    affiliate_click: ["event", "link_id", "source"],
    export_rating: ["event", "rating", "format", "source", "country"],
    export_comment: ["event", "rating", "format", "source", "country", "comment"],
} as const;

export interface DataPoint {
    indexes: [string];
    blobs: string[];
    doubles: [number];
}

export function exportCompletedDataPoint(event: ExportEvent, context: ExportContext, country: string): DataPoint {
    return {
        indexes: ["export_completed"],
        blobs: ["export_completed", event.format, event.source, country, context.locale, context.template, context.landing, context.role, context.device],
        doubles: [1],
    };
}

export function affiliateClickDataPoint(click: AffiliateClick): DataPoint {
    return { indexes: ["affiliate_click"], blobs: ["affiliate_click", click.id, click.source], doubles: [1] };
}

export function exportRatingDataPoint(rating: ExportRating, country: string): DataPoint {
    return { indexes: ["export_rating"], blobs: ["export_rating", rating.rating, rating.format, rating.source, country], doubles: [1] };
}

export function exportCommentDataPoint(feedback: ExportComment, country: string): DataPoint {
    return {
        indexes: ["export_comment"],
        blobs: ["export_comment", feedback.rating, feedback.format, feedback.source, country, feedback.comment],
        doubles: [1],
    };
}
