import { getCloudflareContext } from "@opennextjs/cloudflare";
import { parseAffiliateClick, parseExportEvent } from "@/lib/analytics/export-event";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256;

/**
 * Counts one anonymous event: a finished export (format) or a click on a partner
 * link (link id). Writes a single data point to Workers Analytics Engine: no
 * cookie, no IP, no user agent, no resume data. Always answers 204, so the page
 * never learns whether it was counted.
 */
export async function POST(request: Request) {
    try {
        const text = await request.text();
        if (text.length <= MAX_BODY_BYTES) {
            const body: unknown = JSON.parse(text);
            const { env } = getCloudflareContext();
            const click = parseAffiliateClick(body);
            if (click) {
                env?.EVENTS?.writeDataPoint({
                    indexes: ["affiliate_click"],
                    blobs: ["affiliate_click", click.id, click.source],
                    doubles: [1],
                });
            } else {
                const event = parseExportEvent(body);
                if (event) {
                    env?.EVENTS?.writeDataPoint({
                        indexes: ["export_completed"],
                        blobs: ["export_completed", event.format, event.source],
                        doubles: [1],
                    });
                }
            }
        }
    } catch {
        // Malformed body or no binding (local dev): nothing to record.
    }
    return new Response(null, { status: 204 });
}
