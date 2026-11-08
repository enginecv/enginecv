import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResourcesPage } from "@/components/resources/ResourcesPage";
import { isPrefixedLocale } from "@/lib/i18n/locales";
import { resourcesMetadata } from "@/lib/resources-metadata";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
    const { lang } = await params;
    return isPrefixedLocale(lang) ? resourcesMetadata(lang) : {};
}

export default async function LocalizedResourcesPage({ params }: { params: Promise<{ lang: string }> }) {
    const { lang } = await params;
    if (!isPrefixedLocale(lang)) notFound();
    return <ResourcesPage locale={lang} />;
}
