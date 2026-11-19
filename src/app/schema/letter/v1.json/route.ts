import { buildLetterJsonSchema } from "@/lib/letters/file-format";

// Prerendered at build time, like the authoring schema: tools fetch this, so it costs no Worker CPU.
export const dynamic = "force-static";

export function GET() {
    return new Response(JSON.stringify(buildLetterJsonSchema(), null, 2), {
        headers: {
            "Content-Type": "application/schema+json; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
        },
    });
}
