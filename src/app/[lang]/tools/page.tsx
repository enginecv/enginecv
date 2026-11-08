import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolsIndex } from "@/components/tools/ToolsIndex";
import { isPrefixedLocale } from "@/lib/i18n/locales";
import { toolsIndexMetadata } from "@/lib/tools/tool-metadata";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
    const { lang } = await params;
    return isPrefixedLocale(lang) ? toolsIndexMetadata(lang) : {};
}

export default async function LocalizedToolsIndexPage({ params }: { params: Promise<{ lang: string }> }) {
    const { lang } = await params;
    if (!isPrefixedLocale(lang)) notFound();
    return <ToolsIndex locale={lang} />;
}
