"use client";

import { FadeIn } from "./FadeIn";
import { useTranslation } from "@/lib/i18n";

const STEP_ICONS = [
  <svg key="1" className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="18" x2="12" y2="12" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </svg>,
  <svg key="2" className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>,
  <svg key="3" className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>,
];

export function HowItWorks() {
  const { t } = useTranslation();

  const steps = [
    { number: "01", title: t("landing.howItWorks.step1Title"), description: t("landing.howItWorks.step1Desc"), icon: STEP_ICONS[0] },
    { number: "02", title: t("landing.howItWorks.step2Title"), description: t("landing.howItWorks.step2Desc"), icon: STEP_ICONS[1] },
    { number: "03", title: t("landing.howItWorks.step3Title"), description: t("landing.howItWorks.step3Desc"), icon: STEP_ICONS[2] },
  ];

  return (
    <section id="how-it-works" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-strong text-center mb-4">
            {t("howItWorks.title")}
          </h2>
          <p className="text-faint text-center text-lg mb-16">
            {t("landing.howItWorks.subtitle")}
          </p>
        </FadeIn>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connecting line (desktop only) */}
          <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-px bg-gradient-to-r from-accent/0 via-accent/40 to-accent/0" />

          {steps.map((step, i) => (
            <FadeIn key={step.number} delay={i * 150}>
              <div className="relative text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 text-accent mb-6 relative z-10">
                  {step.icon}
                </div>
                <div className="text-xs font-bold text-accent mb-2 tracking-widest uppercase">
                  {t("howItWorks.step")} {step.number}
                </div>
                <h3 className="text-xl font-semibold text-strong mb-3">
                  {step.title}
                </h3>
                <p className="text-faint leading-relaxed">
                  {step.description}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
