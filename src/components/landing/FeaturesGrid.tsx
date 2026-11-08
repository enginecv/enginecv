"use client";

import { FadeIn } from "./FadeIn";
import { useTranslation } from "@/lib/i18n";
import { getBuiltinTemplates } from "@/lib/templates/enginecv-templates";

const FEATURE_ICONS = [
  <svg key="1" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
  <svg key="3" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  <svg key="4" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="7.5 4.21 12 6.81 16.5 4.21" /><polyline points="7.5 19.79 7.5 14.6 3 12" /><polyline points="21 12 16.5 14.6 16.5 19.79" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg>,
  <svg key="5" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>,
];

// The parse claim states how many templates are checked, so it is fed from the
// template registry and cannot drift from what ships (see parse-results.md).
const TEMPLATE_COUNT = getBuiltinTemplates().length;

const FEATURE_KEYS = [
  { title: "landing.features.unlimitedResumes", desc: "landing.features.unlimitedResumesDesc" },
  { title: "landing.features.atsTemplates", desc: "landing.features.atsTemplatesDesc" },
  { title: "landing.features.livePreview", desc: "landing.features.livePreviewDesc" },
  { title: "landing.features.deepCustomization", desc: "landing.features.deepCustomizationDesc" },
];

export function FeaturesGrid() {
  const { t } = useTranslation();

  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-strong text-center mb-4">
            {t("landing.featureGrid.title")}
          </h2>
          <p className="text-faint text-center text-lg mb-16">
            {t("landing.featureGrid.subtitle")}
          </p>
        </FadeIn>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURE_KEYS.map((feature, i) => (
            <FadeIn key={feature.title} delay={i * 100}>
              <div className="group bg-surface-4 border border-edge rounded-[1.25rem] p-6 hover:border-accent/30 hover:bg-surface-5 transition-all duration-300 h-full">
                <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-4 group-hover:bg-accent/20 transition-colors">
                  {FEATURE_ICONS[i]}
                </div>
                <h3 className="text-lg font-semibold text-strong mb-2">
                  {t(feature.title)}
                </h3>
                <p className="text-faint text-sm leading-relaxed">
                  {t(feature.desc, { templateCount: TEMPLATE_COUNT })}
                </p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
