import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClientPreferencesBootstrap } from "@/components/ClientPreferencesBootstrap";
import { AdConsentPrompt } from "@/components/integrations/AdConsentPrompt";
import { LegacyTrackingPurge } from "@/components/integrations/LegacyTrackingPurge";
import { WipeListener } from "@/components/your-data/WipeListener";
import { SiteScripts } from "@/components/integrations/SiteScripts";
import { SkipLink } from "@/components/ui/SkipLink";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RouteLocaleProvider } from "@/lib/i18n/route-locale";
import { RememberRouteLocale } from "@/components/landing/RememberRouteLocale";
import { DocumentLanguage } from "@/components/app-shell/DocumentLanguage";
import type { Locale } from "@/lib/i18n/locales";
import { DICTIONARY_GATES } from "@/components/app-shell/dictionary-gates";
import { adsConfig } from "@/lib/ads";
import { SHARE_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import "@/app/globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

/** Metadata shared by every root layout; locale layouts override title and description. */
export const rootMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    type: "website",
    locale: "en",
    images: [SHARE_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [SHARE_IMAGE] },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-48.png", type: "image/png", sizes: "48x48" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  // Ownership verification only: a meta tag loads nothing, so it is safe while ads are off.
  ...(adsConfig.client ? { other: { "google-adsense-account": adsConfig.client } } : {}),
};

export const rootViewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4f2" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1c1e" },
  ],
};

/* Runs before paint so a stored light preference never flashes dark. */
const themeInitScript = `try{var p=JSON.parse(localStorage.getItem("enginecv-preferences")||"null");var t=p&&p.preferences&&p.preferences.appearance&&p.preferences.appearance.theme||localStorage.getItem("enginecv-theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}if(t==="light"){document.documentElement.setAttribute("data-theme","light")}}catch(e){}`;

/**
 * The <html> document. Each root layout passes its language, so a localized
 * page is server-rendered with the right lang attribute. Locale URLs also pass
 * `routeLocale`, so everything on the page (skip link included) uses it.
 */
export async function RootDocument({
  lang,
  routeLocale,
  children,
}: Readonly<{
  lang: string;
  routeLocale?: Locale;
  children: React.ReactNode;
}>) {
  const body = (
    <>
      <DocumentLanguage />
      <SkipLink />
      <ClientPreferencesBootstrap />
      {routeLocale && routeLocale !== "en" ? <RememberRouteLocale locale={routeLocale} /> : null}
      <LegacyTrackingPurge />
      <WipeListener />
      <TooltipProvider delayDuration={300}>
        {children}
      </TooltipProvider>
      <AdConsentPrompt />
    </>
  );

  return (
    <html lang={lang} data-scroll-behavior="smooth" suppressHydrationWarning>
      {/* The root document owns <head>; next/head is for the pages router. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <SiteScripts />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {routeLocale ? (
          <DictionaryGate locale={routeLocale}>
            <RouteLocaleProvider locale={routeLocale}>{body}</RouteLocaleProvider>
          </DictionaryGate>
        ) : body}
      </body>
    </html>
  );
}

/** Supplies a non-English locale's dictionary from a client chunk, not the RSC payload. */
function DictionaryGate({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  if (locale === "en") return <>{children}</>;
  const Gate = DICTIONARY_GATES[locale];
  return <Gate>{children}</Gate>;
}
