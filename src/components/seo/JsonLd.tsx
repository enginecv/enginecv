import { jsonLdString, type JsonLdNode } from "@/lib/structured-data";

/** schema.org structured data for crawlers, rendered into the server HTML. */
export function JsonLd({ nodes }: { nodes: JsonLdNode[] }) {
    return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(nodes) }} />;
}
