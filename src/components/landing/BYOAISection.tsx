"use client";

import { FadeIn } from "./FadeIn";
import { useTranslation } from "@/lib/i18n";

function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 text-success shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function BYOAISection() {
  const { t } = useTranslation();
  const providers = [
    {
      title: t("landing.ai.modeBrowserTitle"),
      description: t("landing.ai.modeBrowserDesc"),
      status: t("landing.ai.modePlanned"),
      statusClassName: "text-warning",
      color: "var(--success)",
    },
    {
      title: "Ollama",
      description: t("landing.ai.modeOllamaDesc"),
      status: t("landing.ai.modePlanned"),
      statusClassName: "text-warning",
      color: "var(--accent)",
    },
    {
      title: t("landing.ai.modeApiTitle"),
      description: t("landing.ai.modeApiDesc"),
      status: t("landing.ai.modePlanned"),
      statusClassName: "text-warning",
      color: "var(--info)",
    },
    {
      title: t("landing.ai.modeManagedTitle"),
      description: t("landing.ai.modeManagedDesc"),
      status: t("landing.ai.modeLater"),
      statusClassName: "text-info-violet",
      color: "var(--info-violet)",
    },
  ];

  return (
    <section id="byoai" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <FadeIn>
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-strong mb-6">
                {t("landing.ai.title1")}
                <br />
                <span className="bg-gradient-to-r from-accent to-accent-soft bg-clip-text text-transparent">
                  {t("landing.ai.title2")}
                </span>
              </h2>
              <p className="text-faint text-lg mb-8 leading-relaxed">
                {t("landing.ai.description")}
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-strong/80">
                  <CheckIcon />
                  {t("landing.ai.bullet1")}
                </div>
                <div className="flex items-center gap-3 text-strong/80">
                  <CheckIcon />
                  {t("landing.ai.bullet2")}
                </div>
                <div className="flex items-center gap-3 text-strong/80">
                  <CheckIcon />
                  {t("landing.ai.bullet3")}
                </div>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={200}>
            <div className="space-y-3">
              {providers.map((provider) => (
                <div
                  key={provider.title}
                  className="flex items-center gap-4 bg-surface-4 border border-edge rounded-xl px-5 py-4 hover:border-faint transition-colors"
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: provider.color }}
                  />
                  <div className="min-w-0">
                    <div className="text-strong font-medium">{provider.title}</div>
                    <div className="text-sm text-faint leading-relaxed">{provider.description}</div>
                  </div>
                  <span className={`ml-auto shrink-0 text-xs font-medium ${provider.statusClassName}`}>
                    {provider.status}
                  </span>
                </div>
              ))}
              <div className="bg-surface-1 border border-dashed border-edge rounded-2xl p-5">
                <p className="text-sm text-faint leading-relaxed">
                  {t("landing.ai.footnote")}
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
