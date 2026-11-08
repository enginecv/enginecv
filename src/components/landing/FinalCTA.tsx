"use client";

import { AppEntryLink } from "@/components/ui/AppEntryLink";
import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export function FinalCTA() {
  const { t } = useTranslation();

  return (
    <section className="px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl border-y border-edge">
        <div className="grid gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)] lg:items-end">
          <div>
            <p className="font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-accent">
              {t("landing.cta.kicker")}
            </p>
            <h2 className="mt-5 max-w-4xl text-4xl font-black leading-[0.95] tracking-[-0.05em] text-strong sm:text-6xl lg:text-7xl">
              {t("landing.cta.title")}
            </h2>
          </div>
          <div className="lg:pb-1">
            <AppEntryLink
              href="/dashboard"
              className="group flex min-h-14 w-full items-center justify-between rounded-lg bg-accent px-6 text-lg font-semibold text-surface-0 transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t("cta.button")}
              <ArrowUpRight className="h-5 w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
            </AppEntryLink>
            <p className="mt-4 text-sm leading-6 text-faint">{t("landing.cta.noSignup")}</p>
          </div>
        </div>
        <div className="h-1 w-full bg-[linear-gradient(90deg,var(--accent)_0_34%,var(--info)_34%_68%,var(--success)_68%_100%)]" />
      </div>
    </section>
  );
}
