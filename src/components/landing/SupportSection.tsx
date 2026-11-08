"use client";

import Link from "next/link";
import { ArrowUpRight, Coffee, Github } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { ENGINECV_GITHUB_PROFILE_URL, getGithubSponsorsUrl, getKofiUrl, githubSponsorsEnabled } from "@/lib/support";

export function SupportSection() {
  const { t } = useTranslation();

  return (
    <section
      id="support"
      className="border-b border-edge px-6 py-20 sm:py-24"
      data-testid="landing-support-section"
    >
      <div className="mx-auto max-w-7xl border-y border-edge">
        <div className="grid gap-10 py-10 sm:py-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] lg:items-center">
          <div>
            <p className="font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-accent">
              {t("landing.support.kicker")}
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight tracking-[-0.04em] text-strong sm:text-4xl">
              {t("landing.support.title")}
            </h2>
            <p className="mt-3 flex flex-wrap items-center gap-x-1.5 text-sm leading-6 text-faint">
              <span>{t("landing.support.builtBy")}</span>
              <a
                href={ENGINECV_GITHUB_PROFILE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-bright underline decoration-edge-strong underline-offset-4 transition-colors hover:text-accent focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Github className="h-4 w-4" aria-hidden="true" />
                Safet
              </a>
              <span aria-hidden="true">.</span>
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-mid sm:text-lg">
              {t("landing.support.description")}
            </p>
          </div>

          <div className="lg:border-l lg:border-edge lg:pl-10">
            <a
              href={getKofiUrl("landing")}
              target="_blank"
              rel="noreferrer"
              className="group flex min-h-14 w-full items-center justify-between gap-4 rounded-lg bg-accent px-5 font-semibold text-surface-0 transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2"
            >
              <span className="flex items-center gap-3">
                <Coffee className="h-5 w-5" aria-hidden="true" />
                {t("landing.support.cta")}
              </span>
              <ArrowUpRight
                className="h-5 w-5 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </a>
            {githubSponsorsEnabled() && (
              <a
                href={getGithubSponsorsUrl("landing")}
                target="_blank"
                rel="noreferrer"
                data-testid="landing-support-github-sponsors"
                className="mt-3 flex min-h-12 w-full items-center justify-between gap-4 rounded-lg border border-edge px-5 text-sm font-semibold text-bright transition-colors hover:border-faint hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2"
              >
                <span className="flex items-center gap-3">
                  <Github className="h-5 w-5" aria-hidden="true" />
                  {t("landing.support.githubSponsors")}
                </span>
                <ArrowUpRight className="h-5 w-5 shrink-0" aria-hidden="true" />
              </a>
            )}
            <p className="mt-4 text-sm leading-6 text-faint">
              {t("landing.support.note")}{" "}
              <Link
                href="/supporters"
                className="font-semibold text-bright underline decoration-edge-strong underline-offset-4 transition-colors hover:text-accent focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t("landing.support.supportersLink")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
