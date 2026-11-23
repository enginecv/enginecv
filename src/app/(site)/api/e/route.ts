import { getCloudflareContext } from "@opennextjs/cloudflare";
import { normalizeCountry, parseAffiliateClick, parseExportContext, parseExportComment, parseExportEvent, parseExportRating } from "@/lib/analytics/export-event";
import { affiliateClickDataPoint, exportCommentDataPoint, exportCompletedDataPoint, exportRatingDataPoint } from "@/lib/analytics/event-schema";

export const dynamic = "force-dynamic";

// Room for an optional 280-character comment (see MAX_COMMENT_LENGTH).
const MAX_BODY_BYTES = 1024;

/**
 * Counts one anonymous event: a finished export (format), a click on a partner
 * link (link id) or an optional thumbs up/down on an export (plus an optional short comment, with emails, links and long numbers removed). Column meanings live
 * in lib/analytics/event-schema.ts and docs/analytics.md. Writes a single data point to Workers Analytics Engine: no
 * cookie, no IP, no user agent, no resume data. An export also carries coarse
 * context (country from the edge, site language, built-in template, landing
 * page, role example, mobile or desktop), each reduced to an allow-listed token.
 * Always answers 204, so the page never learns whether it was counted.
 */
export async function POST(request: Request) {
    try {
        const text = await request.text();
        if (text.length <= MAX_BODY_BYTES) {
            const body: unknown = JSON.parse(text);
            const { env, cf } = getCloudflareContext();
            const country = normalizeCountry(cf?.country);
            const click = parseAffiliateClick(body);
            const rating = click ? null : parseExportRating(body);
            // A body that names an event type is never an export, even when it is malformed.
            const named = typeof body === "object" && body !== null && "event" in body;
            const comment = click || rating ? null : parseExportComment(body);
            const event = click || rating || comment || named ? null : parseExportEvent(body);
            if (click) env?.EVENTS?.writeDataPoint(affiliateClickDataPoint(click));
            else if (rating) env?.EVENTS?.writeDataPoint(exportRatingDataPoint(rating, country));
            else if (comment) env?.EVENTS?.writeDataPoint(exportCommentDataPoint(comment, country));
            else if (event) env?.EVENTS?.writeDataPoint(exportCompletedDataPoint(event, parseExportContext(body), country));
        }
    } catch {
        // Malformed body or no binding (local dev): nothing to record.
    }
    return new Response(null, { status: 204 });
}
