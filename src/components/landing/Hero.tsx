"use client";

import { IntentPrefetchLink } from "@/components/ui/IntentPrefetchLink";
import { AppEntryLink } from "@/components/ui/AppEntryLink";
import { getExportFormatClaimParams } from "@/lib/export-formats";
import { SOURCE_REPO_URL } from "@/lib/contact";
import { useTranslation } from "@/lib/i18n";
import { APP_VERSION } from "@/lib/app-version";
import { ArrowRight, Check, Github } from "lucide-react";
import { LazyWorkbenchDemo } from "./LazyWorkbenchDemo";
import { localizedPath } from "@/lib/i18n/locales";
import { GALLERY_PATH } from "@/lib/templates/gallery";

export function Hero() {
  const { t, locale } = useTranslation();
  const formatParams = getExportFormatClaimParams(t);

  const trustItems = [
    t("landing.hero.badgePdfFree"),
    `${t("hero.noPrefix")} ${t("hero.noTermAccount")}`,
    `${t("hero.noPrefix")} ${t("hero.noTermPaywall")}`,
    t("landing.hero.badgePdf", formatParams),
    t("landing.hero.badgeBrowser"),
  ];

  return (
    <section className="relative overflow-hidden border-b border-edge px-6 pb-20 pt-14 sm:pb-24 sm:pt-20">
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(to_right,var(--edge)_1px,transparent_1px),linear-gradient(to_bottom,var(--edge)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />
      <div className="pointer-events-none absolute left-0 right-0 top-8 mx-auto h-px max-w-7xl bg-edge">
        <div className="h-2 w-px bg-edge-strong" />
        <div className="absolute right-0 top-0 h-2 w-px bg-edge-strong" />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 xl:grid-cols-[minmax(0,0.62fr)_minmax(760px,1.38fr)] xl:gap-10">
        <div className="min-w-0 text-left xl:pr-4">
          <div className="mb-8 flex items-center gap-3 font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.18em] text-accent">
            <span className="h-px w-8 bg-accent" aria-hidden="true" />
            {t("landing.hero.workbenchKicker")} · v{APP_VERSION}
          </div>

          <h1
            data-testid="hero-headline"
            className="max-w-3xl text-balance text-[clamp(2.2rem,8vw,3.6rem)] xl:text-[clamp(2.4rem,3.3vw,3.1rem)] font-black leading-[1.05] tracking-[-0.045em] text-strong"
          >
            {t("hero.headline")}
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-8 text-mid sm:text-xl">
            {t("landing.hero.description1")}
          </p>

          <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <AppEntryLink
              href="/dashboard"
              className="group inline-flex whitespace-nowrap min-h-12 touch-manipulation items-center justify-center gap-2 rounded-lg bg-accent px-6 text-base font-semibold text-surface-0 transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t("hero.startBuilding")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </AppEntryLink>
            <IntentPrefetchLink
              href={localizedPath(GALLERY_PATH, locale)}
              className="inline-flex whitespace-nowrap min-h-12 touch-manipulation items-center justify-center rounded-lg px-3 text-base font-medium text-mid underline decoration-edge-strong underline-offset-4 transition-colors hover:text-strong hover:decoration-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t("hero.viewTemplates")}
            </IntentPrefetchLink>
          </div>
          <p className="mt-3 text-sm text-dim" data-testid="landing-hero-local-note">
            {t("landing.hero.localNote")}
          </p>

          <div
            className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3 border-y border-edge py-4 text-[13px] text-mid"
            data-testid="landing-hero-proof-line"
          >
            {trustItems.map((item) => (
              <div key={item} className="inline-flex items-center gap-2 whitespace-nowrap">
                <Check className="h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2.5} aria-hidden="true" />
                {item}
              </div>
            ))}
            <a
              href={SOURCE_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 whitespace-nowrap transition-colors hover:text-strong focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Github className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
              {t("landing.hero.badgeOpenSource")}
            </a>
          </div>

          <p className="mt-5 max-w-xl text-sm leading-6 text-dim">
            {t("landing.hero.openSource")}{" "}
            <a
              href={SOURCE_REPO_URL}
              target="_blank"
              rel="noreferrer"
              data-testid="landing-hero-source-link"
              className="inline-flex items-center gap-1.5 font-semibold text-bright underline decoration-edge-strong underline-offset-4 transition-colors hover:text-accent focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Github className="h-4 w-4" aria-hidden="true" />
              {t("landing.hero.openSourceLink")}
            </a>
          </p>
        </div>

        <LazyWorkbenchDemo />
      </div>
    </section>
  );
}
