import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { incrementReferralCount, normalizeReferralSlug } from "@/lib/referral";

/**
 * Redirects to a support page and bumps the placement's referral counter.
 * Same contract as /r/<slug>: no cookies, nothing derived from the visitor, only a hit counter.
 */
export async function redirectCountingPlacement(target: string, counterSlug: string): Promise<NextResponse> {
    const slug = normalizeReferralSlug(counterSlug);
    const response = NextResponse.redirect(target);

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
