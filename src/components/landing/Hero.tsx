"use client";

import { IntentPrefetchLink } from "@/components/ui/IntentPrefetchLink";
import { AppEntryLink } from "@/components/ui/AppEntryLink";
import { getExportFormatClaimParams } from "@/lib/export-formats";
import { useTranslation } from "@/lib/i18n";
import { APP_VERSION } from "@/lib/app-version";
import { ArrowRight, Check } from "lucide-react";
import { LazyWorkbenchDemo } from "./LazyWorkbenchDemo";
import styles from "./Hero.module.css";
import { localizedPath } from "@/lib/i18n/locales";
import { GALLERY_PATH } from "@/lib/templates/gallery";

export function Hero() {
  const { t, locale } = useTranslation();
  const formatParams = getExportFormatClaimParams(t);

  const heroTerms = [
    t("hero.noTermAccount"),
    t("hero.noTermPaywall"),
    t("hero.noTermNonsense"),
  ];

  const trustItems = [
    t("landing.hero.badgeBrowser"),
    t("landing.hero.badgePdf", formatParams),
    t("landing.hero.badgeNoLockin"),
  ];

  return (
    <section className="relative overflow-hidden border-b border-edge px-6 pb-20 pt-14 sm:pb-24 sm:pt-20">
      <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(to_right,var(--edge)_1px,transparent_1px),linear-gradient(to_bottom,var(--edge)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />
      <div className="pointer-events-none absolute left-0 right-0 top-8 mx-auto h-px max-w-7xl bg-edge">
        <div className="h-2 w-px bg-edge-strong" />
        <div className="absolute right-0 top-0 h-2 w-px bg-edge-strong" />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 xl:grid-cols-[minmax(0,0.76fr)_minmax(680px,1.24fr)] xl:gap-10">
        <div className="min-w-0 text-left xl:pr-4">
          <div className="mb-8 flex items-center gap-3 font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.18em] text-accent">
            <span className="h-px w-8 bg-accent" aria-hidden="true" />
            {t("landing.hero.workbenchKicker")} · v{APP_VERSION}
          </div>

          <h1
            aria-label={t("hero.noRotationLabel")}
            className="text-[clamp(2.7rem,11vw,4.8rem)] font-black leading-none tracking-[-0.065em] text-strong xl:text-[clamp(3.35rem,4.5vw,4.8rem)]"
          >
            <span aria-hidden="true" className="flex max-w-full flex-col items-start">
              <span data-testid="hero-no-prefix">{t("hero.noPrefix")}</span>
              <span
                className="hero-term-window relative -mt-[0.06em] block h-[1em] max-w-full overflow-hidden whitespace-nowrap border-b border-accent/30 pr-[0.16em] text-accent"
                data-testid="hero-term-window"
              >
                <span className={`${styles.termTrack} flex flex-col`} data-testid="hero-term-track">
                  {[...heroTerms, heroTerms[0]].map((term, index) => (
                    <span
                      key={`${term}-${index}`}
                      className="flex h-[1em] shrink-0 items-center leading-none"
                    >
                      {term}
                    </span>
                  ))}
                </span>
              </span>
            </span>
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-8 text-mid sm:text-xl">
            {t("landing.hero.description1")}
          </p>

          <div className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <AppEntryLink
              href="/dashboard"
              className="group inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-lg bg-accent px-6 text-base font-semibold text-surface-0 transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t("hero.startBuilding")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </AppEntryLink>
            <IntentPrefetchLink
              href={localizedPath(GALLERY_PATH, locale)}
              className="inline-flex min-h-12 touch-manipulation items-center justify-center rounded-lg border border-edge-strong bg-surface-2/80 px-6 text-base font-medium text-strong transition-colors hover:bg-surface-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t("hero.viewTemplates")}
            </IntentPrefetchLink>
          </div>

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
          </div>
        </div>

        <LazyWorkbenchDemo />
      </div>
    </section>
  );
}
