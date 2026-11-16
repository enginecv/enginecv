"use client";

import { ArrowRight, Check, FileJson2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

// Sample file text, the same in every language: it is data, not interface text.
const SAMPLE_FILE_NAME = "john-doe.resume.json";
const SAMPLE_JSON = `{
  "basics": {
    "name": "John Doe",
    "label": "Senior Product Designer"
  },
  "work": [
    { "name": "Acme", "position": "Designer" }
  ]
}`;
const JSON_RESUME_URL = "https://jsonresume.org";

const POINT_KEYS = [
  "landing.jsonResume.point1",
  "landing.jsonResume.point2",
  "landing.jsonResume.point3",
] as const;

/** The open-standard export, shown with what it looks like. */
export function JsonResumeSection() {
  const { t } = useTranslation();

  return (
    <section id="json-resume" className="border-b border-edge bg-surface-1 px-6 py-24 sm:py-32" data-testid="landing-json-resume">
      <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-2 lg:items-center lg:gap-20">
        <div className="order-2 lg:order-1">
          <div className="overflow-hidden rounded-[1.1rem] border border-edge-strong bg-surface-0 shadow-[0_24px_70px_rgba(0,0,0,0.22)]" aria-hidden="true">
            <div className="flex items-center justify-between gap-2 border-b border-edge px-5 py-3">
              <span className="flex items-center gap-2 text-sm font-medium text-strong">
                <FileJson2 className="h-4 w-4 text-accent" />
                <code className="font-[family-name:var(--font-geist-mono)] text-xs text-strong">{SAMPLE_FILE_NAME}</code>
              </span>
              <span className="font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-bright">{t("landing.jsonResume.mockLabel")}</span>
            </div>
            <pre className="overflow-x-auto px-5 py-4 font-[family-name:var(--font-geist-mono)] text-xs leading-6 text-bright">{SAMPLE_JSON}</pre>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <p className="font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-accent">
            {t("landing.jsonResume.kicker")}
          </p>
          <h2 className="mt-5 text-4xl font-black leading-[0.98] tracking-[-0.045em] text-strong sm:text-5xl">
            {t("landing.jsonResume.title1")}
            <span className="mt-1 block text-accent">{t("landing.jsonResume.title2")}</span>
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-8 text-mid">{t("landing.jsonResume.description")}</p>
          <ul className="mt-8 space-y-2 text-sm text-bright">
            {POINT_KEYS.map((key) => (
              <li key={key} className="flex items-start gap-3 border-t border-edge py-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={2.5} aria-hidden="true" />
                {t(key)}
              </li>
            ))}
          </ul>
          <a
            href={JSON_RESUME_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-bright underline decoration-edge-strong underline-offset-4 transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("landing.jsonResume.link")}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
