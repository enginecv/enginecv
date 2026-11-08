"use client";

import { FadeIn } from "./FadeIn";
import { getExportFormatClaimParams } from "@/lib/export-formats";
import { useTranslation } from "@/lib/i18n";

const FREE_FEATURE_KEYS = [
  "landing.free.unlimitedResumes",
  "landing.free.unlimitedDownloads",
  "landing.free.livePreview",
  "landing.free.jsonExport",
  "landing.free.exportFormats",
  "landing.free.versionHistory",
  "landing.free.deepCustomization",
];

const ANIMATED_GRADIENT =
  "linear-gradient(115deg, #60a5fa 0%, #ffecCD 18%, #ffd4a0 30%, #8a8aa8 50%, #a87355 72%, #6b3410 100%)";

export function FreeVersionSection() {
  const { t } = useTranslation();
  const formatParams = getExportFormatClaimParams(t);

  return (
    <section className="py-24 px-6">
      <style>{`
        @keyframes engineGradientShimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
      <div className="max-w-4xl mx-auto text-center">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-strong mb-6">
            {t("landing.free.title")}
          </h2>
          <p
            className="pb-4 text-6xl sm:text-8xl lg:text-9xl font-black leading-[0.95] break-words bg-clip-text text-transparent select-none"
            style={{
              backgroundImage: ANIMATED_GRADIENT,
              backgroundSize: "300% 100%",
              WebkitBackgroundClip: "text",
              animation: "engineGradientShimmer 8s ease-in-out infinite",
              willChange: "background-position",
            }}
          >
            {t("landing.free.everything")}
          </p>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-3xl mx-auto mb-12 mt-8">
            {FREE_FEATURE_KEYS.map((key) => (
              <div
                key={key}
                className="flex items-center gap-2 text-strong/80 text-sm"
              >
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
                {t(key, formatParams)}
              </div>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={300}>
          <p className="text-faint text-lg">
            {t("landing.free.footer")}
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
