import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolPage } from "@/components/tools/ToolPage";
import { getEnabledTools, getTool } from "@/lib/tools/registry";
import { toolMetadata } from "@/lib/tools/tool-metadata";

export const dynamicParams = false;

export function generateStaticParams() {
    return getEnabledTools().map(({ slug }) => ({ tool: slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }): Promise<Metadata> {
    const tool = getTool((await params).tool);
    return tool ? toolMetadata("en", tool) : {};
}

export default async function ToolDetailPage({ params }: { params: Promise<{ tool: string }> }) {
    const tool = getTool((await params).tool);
    if (!tool) notFound();
    return <ToolPage locale="en" tool={tool} />;
}
