import { getCloudflareContext } from "@opennextjs/cloudflare";
import { parseExportEvent } from "@/lib/analytics/export-event";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256;

/**
 * Counts one finished export. Writes a single data point (event, format, source)
 * to Workers Analytics Engine: no cookie, no IP, no user agent, no resume data.
 * Always answers 204, so the page never learns whether it was counted.
 */
export async function POST(request: Request) {
    try {
        const text = await request.text();
        if (text.length <= MAX_BODY_BYTES) {
            const event = parseExportEvent(JSON.parse(text));
            if (event) {
                const { env } = getCloudflareContext();
                env?.EVENTS?.writeDataPoint({
                    indexes: ["export_completed"],
                    blobs: ["export_completed", event.format, event.source],
                    doubles: [1],
                });
            }
        }
    } catch {
        // Malformed body or no binding (local dev): nothing to record.
    }
    return new Response(null, { status: 204 });
}
