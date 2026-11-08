import { buildAuthoringJsonSchema } from "@/lib/agent/authoring/json-schema";

// Prerendered at build time: AIs and tools fetch this, so it costs no Worker CPU.
export const dynamic = "force-static";

export function GET() {
    return new Response(JSON.stringify(buildAuthoringJsonSchema(), null, 2), {
        headers: {
            "Content-Type": "application/schema+json; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
        },
    });
}
