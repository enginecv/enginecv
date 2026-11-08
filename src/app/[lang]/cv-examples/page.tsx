import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoleExamplesIndexPage, roleExamplesIndexMetadata } from "@/components/role-examples/RoleExamplesIndexPage";
import { isPrefixedLocale } from "@/lib/i18n/locales";
import { indexLocales } from "@/lib/role-examples/rules";

// Only languages with at least one published example have an index; no fallback to another language.
export const dynamicParams = false;

export function generateStaticParams() {
    return indexLocales().filter(isPrefixedLocale).map((lang) => ({ lang }));
}

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { lang } = await params;
    return isPrefixedLocale(lang) ? roleExamplesIndexMetadata(lang) : {};
}

export default async function LocalizedRoleExamplesIndexPage({ params }: { params: Params }) {
    const { lang } = await params;
    if (!isPrefixedLocale(lang)) notFound();
    return <RoleExamplesIndexPage locale={lang} />;
}
