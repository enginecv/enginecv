import { NextResponse } from "next/server";
import { redirectCountingPlacement } from "@/lib/support-redirect";
import {
    ENGINECV_GITHUB_SPONSORS_URL,
    githubSponsorsEnabled,
    githubSponsorsPlacementCounterSlug,
} from "@/lib/support";

export const dynamic = "force-dynamic";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ placement: string }> },
) {
    // Until GitHub approves the profile the Sponsors page 404s, so send stray links to our own page.
    if (!githubSponsorsEnabled()) {
        return NextResponse.redirect(new URL("/supporters", request.url));
    }

    const { placement } = await params;
    return redirectCountingPlacement(ENGINECV_GITHUB_SPONSORS_URL, githubSponsorsPlacementCounterSlug(placement));
}
