import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolPage } from "@/components/tools/ToolPage";
import { isPrefixedLocale } from "@/lib/i18n/locales";
import { getEnabledTools, getTool } from "@/lib/tools/registry";
import { toolMetadata } from "@/lib/tools/tool-metadata";

export const dynamicParams = false;

export function generateStaticParams() {
    return getEnabledTools().map(({ slug }) => ({ tool: slug }));
}

type Params = Promise<{ lang: string; tool: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { lang, tool: slug } = await params;
    const tool = getTool(slug);
    return tool && isPrefixedLocale(lang) ? toolMetadata(lang, tool) : {};
}

export default async function LocalizedToolDetailPage({ params }: { params: Params }) {
    const { lang, tool: slug } = await params;
    const tool = getTool(slug);
    if (!tool || !isPrefixedLocale(lang)) notFound();
    return <ToolPage locale={lang} tool={tool} />;
}
