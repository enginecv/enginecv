import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { incrementReferralCount, normalizeReferralSlug } from "@/lib/referral";

export const dynamic = "force-dynamic";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ ref: string }> },
) {
    const { ref } = await params;
    const slug = normalizeReferralSlug(ref);

    // No cookies and nothing derived from the visitor: the link only bumps a hit counter.
    const response = NextResponse.redirect(new URL("/", request.url));

    if (slug) {
        try {
            const { env } = getCloudflareContext();
            if (env?.REFERRALS) {
                await incrementReferralCount(env.REFERRALS, slug);
            }
        } catch {
            // KV unavailable (e.g., local dev without binding) — counter is best-effort.
        }
    }

    return response;
}
