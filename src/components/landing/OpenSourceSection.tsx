"use client";

import { ArrowUpRight, Check, Github } from "lucide-react";
import { SOURCE_REPO_URL } from "@/lib/contact";
import { useTranslation } from "@/lib/i18n";

const CONTRIBUTING_URL = `${SOURCE_REPO_URL}/blob/master/CONTRIBUTING.md`;

const POINT_KEYS = [
  "landing.opensource.pointRead",
  "landing.opensource.pointIssues",
  "landing.opensource.pointContribute",
];

export function OpenSourceSection() {
  const { t } = useTranslation();

  return (
    <section
      id="open-source"
      className="border-b border-edge px-6 py-20 sm:py-24"
      data-testid="landing-open-source-section"
    >
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] lg:items-center lg:gap-16">
        <div>
          <p className="font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-accent">
            {t("landing.opensource.kicker")}
          </p>
          <h2 className="mt-4 text-4xl font-black leading-[0.98] tracking-[-0.045em] text-strong sm:text-5xl">
            {t("landing.opensource.title1")}
            <span className="mt-1 block text-accent">{t("landing.opensource.title2")}</span>
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-mid">{t("landing.opensource.description")}</p>

          <ul className="mt-8 grid gap-x-8 gap-y-1 sm:grid-cols-1">
            {POINT_KEYS.map((key) => (
              <li key={key} className="flex items-start gap-3 border-t border-edge py-3 text-sm text-bright">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={2.5} aria-hidden="true" />
                {t(key)}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:border-l lg:border-edge lg:pl-12">
          <a
            href={SOURCE_REPO_URL}
            target="_blank"
            rel="noreferrer"
            data-testid="landing-open-source-cta"
            className="group flex min-h-14 w-full items-center justify-between gap-4 rounded-lg bg-accent px-5 font-semibold text-surface-0 transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2"
          >
            <span className="flex items-center gap-3">
              <Github className="h-5 w-5" aria-hidden="true" />
              {t("landing.opensource.cta")}
            </span>
            <ArrowUpRight
              className="h-5 w-5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </a>
          <a
            href={CONTRIBUTING_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex min-h-12 w-full items-center justify-between gap-4 rounded-lg border border-edge px-5 text-sm font-semibold text-bright transition-colors hover:border-faint hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2"
          >
            {t("landing.opensource.contributing")}
            <ArrowUpRight className="h-5 w-5 shrink-0" aria-hidden="true" />
          </a>
          <p className="mt-4 text-sm leading-6 text-faint">{t("landing.opensource.licenseNote")}</p>
        </div>
      </div>
    </section>
  );
}
