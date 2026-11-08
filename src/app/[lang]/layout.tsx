import { notFound } from "next/navigation";
import { RootDocument, rootMetadata, rootViewport } from "@/components/app-shell/RootDocument";
import { PREFIXED_LOCALES, isPrefixedLocale } from "@/lib/i18n/locales";

export const metadata = rootMetadata;
export const viewport = rootViewport;

// Only the listed locales exist; "/xx" for anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return PREFIXED_LOCALES.map((lang) => ({ lang }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ lang: string }> }>) {
  const { lang } = await params;
  if (!isPrefixedLocale(lang)) notFound();
  return <RootDocument lang={lang} routeLocale={lang}>{children}</RootDocument>;
}
