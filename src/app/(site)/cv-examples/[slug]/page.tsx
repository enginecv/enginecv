import type { Metadata } from "next";
import { RoleExamplePage, roleExampleMetadata } from "@/components/role-examples/RoleExamplePage";
import { staticSlugs } from "@/lib/role-examples/rules";

// Only versions written in English exist here; no fallback to another language.
export const dynamicParams = false;

export function generateStaticParams() {
    return staticSlugs("en");
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const { slug } = await params;
    return roleExampleMetadata("en", slug);
}

export default async function EnglishRoleExamplePage({ params }: { params: Params }) {
    const { slug } = await params;
    return <RoleExamplePage locale="en" slug={slug} />;
}
