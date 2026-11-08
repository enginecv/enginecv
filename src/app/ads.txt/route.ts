import { adsConfig } from "@/lib/ads";
import { adsTxtContent } from "@/lib/ads-txt";

export const dynamic = "force-static";

export function GET() {
    const content = adsTxtContent(adsConfig.client);
    return new Response(content, {
        status: content ? 200 : 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
}
