import { getCloudflareContext } from "@opennextjs/cloudflare";
import { normalizeCountry, parseAffiliateClick, parseExportContext, parseExportEvent } from "@/lib/analytics/export-event";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 256;

/**
 * Counts one anonymous event: a finished export (format) or a click on a partner
 * link (link id). Writes a single data point to Workers Analytics Engine: no
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
                    const context = parseExportContext(body);
                    env?.EVENTS?.writeDataPoint({
                        indexes: ["export_completed"],
                        blobs: [
                            "export_completed",
                            event.format,
                            event.source,
                            normalizeCountry(cf?.country),
                            context.locale,
                            context.template,
                            context.landing,
                            context.role,
                            context.device,
                        ],
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
