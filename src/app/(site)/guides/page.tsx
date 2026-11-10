import type { Metadata } from "next";
import { BlogLayout } from "@/components/blog/BlogLayout";
import { GuidesIndex } from "@/components/guides/GuidesIndex";
import { JsonLd } from "@/components/seo/JsonLd";
import { GUIDE_COPY } from "@/lib/guides/copy";
import { getPublishedGuideMeta } from "@/lib/guides/guides";
import { GUIDES_PATH, SITE_NAME, pageMetadata } from "@/lib/site";
import { breadcrumbJsonLd } from "@/lib/structured-data";


export async function generateMetadata(): Promise<Metadata> {
    const hasGuides = (await getPublishedGuideMeta()).length > 0;
    return {
        ...pageMetadata({ title: GUIDE_COPY.hub.metaTitle, description: GUIDE_COPY.hub.metaDescription, path: GUIDES_PATH }),
        // Until the first guide is published the hub has nothing to index.
        ...(!hasGuides ? { robots: { index: false, follow: true } } : {}),
    };
}

export default async function GuidesHubPage() {
    const guides = await getPublishedGuideMeta();

    return (
        <BlogLayout>
            <JsonLd nodes={[breadcrumbJsonLd([{ name: SITE_NAME, path: "/" }, { name: GUIDE_COPY.breadcrumb, path: GUIDES_PATH }])]} />
            <GuidesIndex guides={guides} />
        </BlogLayout>
    );
}
