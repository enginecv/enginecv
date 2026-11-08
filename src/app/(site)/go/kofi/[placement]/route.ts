import { redirectCountingPlacement } from "@/lib/support-redirect";
import { ENGINECV_KOFI_URL, kofiPlacementCounterSlug } from "@/lib/support";

export const dynamic = "force-dynamic";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ placement: string }> },
) {
    const { placement } = await params;
    return redirectCountingPlacement(ENGINECV_KOFI_URL, kofiPlacementCounterSlug(placement));
}
