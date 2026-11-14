import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { ProductStory } from "@/components/landing/ProductStory";
import { FreeToolsSection } from "@/components/landing/FreeToolsSection";
import { PrivacySection } from "@/components/landing/PrivacySection";
import { OpenSourceSection } from "@/components/landing/OpenSourceSection";
import { FAQ } from "@/components/landing/FAQ";
import { SupportSection } from "@/components/landing/SupportSection";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Footer } from "@/components/landing/Footer";
import { LocaleSuggestion } from "@/components/landing/LocaleSuggestion";
import { JsonLd } from "@/components/seo/JsonLd";
import { RouteLocaleProvider } from "@/lib/i18n/route-locale";
import type { Locale } from "@/lib/i18n/locales";
import { landingFaqJsonLd, organizationJsonLd, softwareApplicationJsonLd } from "@/lib/structured-data";

/** The landing page in one locale: "/" renders English, "/de" German, and so on. */
export function LandingPage({ locale }: { locale: Locale }) {
  return (
    <RouteLocaleProvider locale={locale}>
      <JsonLd nodes={[organizationJsonLd(), softwareApplicationJsonLd(locale), landingFaqJsonLd(locale)]} />
      <div className="flex min-h-screen flex-col overflow-x-clip bg-surface-2 text-strong font-[family-name:var(--font-geist-sans)]">
        <LocaleSuggestion />
        <Navbar />
        <main id="main-content" className="flex-1">
          <Hero />
          <ProductStory />
          <FreeToolsSection />
          <PrivacySection />
          <OpenSourceSection />
          <FAQ />
          <SupportSection />
          <FinalCTA />
        </main>
        <Footer />
      </div>
    </RouteLocaleProvider>
  );
}
