"use client";

import { FileDown, History, ShieldCheck, type LucideIcon } from "lucide-react";
import { getExportFormatClaimParams } from "@/lib/export-formats";
import { useTranslation } from "@/lib/i18n";
import { FadeIn } from "./FadeIn";

const STATUS_CARDS: Array<{
  title: string;
  description: string;
  Icon: LucideIcon;
}> = [
  {
    title: "landing.hero.modeLocalTitle",
    description: "landing.hero.modeLocalDesc",
    Icon: ShieldCheck,
  },
  {
    title: "landing.hero.modeSyncTitle",
    description: "landing.hero.modeSyncDesc",
    Icon: FileDown,
  },
  {
    title: "landing.hero.modeHistoryTitle",
    description: "landing.hero.modeHistoryDesc",
    Icon: History,
  },
];

export function WhatWorksToday() {
  const { t } = useTranslation();
  const formatParams = getExportFormatClaimParams(t);

  return (
    <section className="px-6 py-16 sm:py-20" aria-labelledby="what-works-today-title">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <div className="mb-10 text-center">
            <h2 id="what-works-today-title" className="text-3xl font-bold text-strong sm:text-4xl">
              {t("landing.features.title")}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-mid">
              {t("landing.features.subtitle")}
            </p>
          </div>
        </FadeIn>

        <div className="grid gap-4 md:grid-cols-3">
          {STATUS_CARDS.map((card, index) => {
            const Icon = card.Icon;

            return (
              <FadeIn key={card.title} delay={index * 100}>
                <div className="h-full rounded-2xl border border-edge bg-surface-4/85 p-6 transition-colors hover:border-accent/30 hover:bg-surface-5">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-strong">
                    {t(card.title)}
                  </h3>
                  <p className="text-sm leading-relaxed text-mid">
                    {t(card.description, formatParams)}
                  </p>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
