import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingPage } from "@/components/landing/LandingPage";
import { isPrefixedLocale } from "@/lib/i18n/locales";
import { landingMetadata } from "@/lib/landing-metadata";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return isPrefixedLocale(lang) ? landingMetadata(lang) : {};
}

export default async function LocalizedLandingPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isPrefixedLocale(lang)) notFound();
  return <LandingPage locale={lang} />;
}
