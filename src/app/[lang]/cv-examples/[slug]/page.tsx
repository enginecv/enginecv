import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoleExamplePage, roleExampleMetadata } from "@/components/role-examples/RoleExamplePage";
import { isPrefixedLocale } from "@/lib/i18n/locales";
import { ROLE_EXAMPLE_LOCALES } from "@/lib/role-examples/registry";
import { staticSlugs } from "@/lib/role-examples/rules";

// Only versions written in this language exist here; no fallback to another language.
export const dynamicParams = false;

// Full { lang, slug } pairs, not filtered by the parent `lang`: Next passes a parent
// through without a slug when a child returns nothing for it (French has no examples),
// which would drop every path of this route. The pairs override the parent's lang.
export function generateStaticParams() {
    return ROLE_EXAMPLE_LOCALES.filter(isPrefixedLocale).flatMap((lang) => staticSlugs(lang).map(({ slug }) => ({ lang, slug })));
}

type Params = Promise<{ lang: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { lang, slug } = await params;
    return isPrefixedLocale(lang) ? roleExampleMetadata(lang, slug) : {};
}

export default async function LocalizedRoleExamplePage({ params }: { params: Params }) {
    const { lang, slug } = await params;
    if (!isPrefixedLocale(lang)) notFound();
    return <RoleExamplePage locale={lang} slug={slug} />;
}
