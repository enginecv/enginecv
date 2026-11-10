import type { Metadata } from "next";
import { GuidePage, guideMetadata } from "@/components/guides/GuidePage";
import { getAllGuideMeta } from "@/lib/guides/guides";

export async function generateStaticParams() {
    return (await getAllGuideMeta()).map(({ slug }) => ({ slug }));
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { slug } = await params;
    return guideMetadata(slug);
}

export default async function SectionGuidePage({ params }: { params: Params }) {
    const { slug } = await params;
    return <GuidePage slug={slug} />;
}
