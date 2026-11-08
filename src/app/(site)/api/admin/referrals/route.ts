import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { listReferralCounts } from "@/lib/referral";

export const dynamic = "force-dynamic";

function unauthorized() {
    return new NextResponse("Unauthorized", { status: 401 });
}

export async function GET(request: Request) {
    const { env } = getCloudflareContext();
    const expected = env?.REFERRAL_ADMIN_TOKEN;

    if (!expected) {
        return new NextResponse("Admin token not configured", { status: 503 });
    }

    const auth = request.headers.get("authorization");
    if (!auth || !auth.startsWith("Bearer ")) return unauthorized();
    const provided = auth.slice("Bearer ".length).trim();
    if (provided !== expected) return unauthorized();

    if (!env?.REFERRALS) {
        return new NextResponse("REFERRALS KV not bound", { status: 503 });
    }

    const counts = await listReferralCounts(env.REFERRALS);
    const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);

    // Hits, not unique visitors: since 022 no visitor data is kept for deduplication.
    return NextResponse.json({
        totalHits: sorted.reduce((sum, [, n]) => sum + n, 0),
        hits: Object.fromEntries(sorted),
    });
}
