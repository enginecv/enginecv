import { NextResponse } from "next/server";

/**
 * Last step of "delete all my data": the Clear-Site-Data header asks the
 * browser to remove what page script cannot reach (HttpOnly cookies such as
 * Cloudflare's __cf_bm, caches). Nothing is read, stored or logged. POST
 * only, same origin only, so links, prefetchers or other sites cannot
 * trigger it.
 */

export const dynamic = "force-dynamic";

const CLEAR_SITE_DATA = "\"cache\", \"cookies\", \"storage\"";

function sameOrigin(request: Request): boolean {
    const origin = request.headers.get("origin");
    if (!origin) return false;
    try {
        // Behind the Worker the request URL may not carry the public host; the headers do.
        const hosts = [new URL(request.url).host, request.headers.get("host"), request.headers.get("x-forwarded-host")];
        return hosts.includes(new URL(origin).host);
    } catch {
        return false;
    }
}

export async function POST(request: Request) {
    if (!sameOrigin(request)) {
        return new NextResponse(null, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    return new NextResponse(null, {
        status: 204,
        headers: { "Clear-Site-Data": CLEAR_SITE_DATA, "Cache-Control": "no-store" },
    });
}

function notAllowed() {
    return new NextResponse(null, { status: 405, headers: { Allow: "POST", "Cache-Control": "no-store" } });
}

export const GET = notAllowed;
export const HEAD = notAllowed;
export const PUT = notAllowed;
export const DELETE = notAllowed;
export const PATCH = notAllowed;
