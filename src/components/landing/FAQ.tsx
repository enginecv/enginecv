"use client";

import { useState } from "react";
import { FadeIn } from "./FadeIn";
import { getExportFormatClaimParams } from "@/lib/export-formats";
import { useTranslation } from "@/lib/i18n";
import { LANDING_FAQ_KEYS } from "@/lib/landing-faq";

interface FAQItem {
  q: string;
  a: string;
}

interface FAQProps {
  items?: FAQItem[];
  title?: string;
  subtitle?: string;
  id?: string;
}

export function FAQ({ items, title, subtitle, id = "faq" }: FAQProps) {
  const { t } = useTranslation();
  const formatParams = getExportFormatClaimParams(t);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqItems: readonly FAQItem[] = items || LANDING_FAQ_KEYS;
  const displayTitle = title || t("faq.title");
  const displaySubtitle = subtitle !== undefined ? subtitle : t("faq.subtitle");

  return (
    <section id={id} className="py-24 px-6">
      <div className="max-w-3xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-strong text-center mb-4">
            {displayTitle}
          </h2>
          {displaySubtitle && (
            <p className="text-faint text-center text-lg mb-12">
              {displaySubtitle}
            </p>
          )}
        </FadeIn>

        <div className="space-y-3">
          {faqItems.map((faq, i) => (
            <FadeIn key={i} delay={i * 80}>
              <div className="border border-edge rounded-xl overflow-hidden hover:border-faint transition-colors">
                <button
                  type="button"
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-5 text-left focus:outline-none"
                >
                  <span className="font-medium text-strong pr-4">{t(faq.q)}</span>
                  <svg
                    className={`w-5 h-5 text-faint shrink-0 transition-transform duration-200 ${
                      openIndex === i ? "rotate-180" : ""
                    }`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <div
                  className={`grid transition-all duration-300 ${
                    openIndex === i
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-5 text-faint leading-relaxed">
                      {t(faq.a, formatParams)}
                    </p>
                  </div>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
