"use client";

import Link from "next/link";
import { ArrowRight, Check, Download, HardDrive, Monitor, TriangleAlert, type LucideIcon } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

const ENGINECV_FEATURE_KEYS = [
  "landing.safety.noServerCopy",
  "landing.safety.noResumeAnalytics",
  "landing.safety.localImports",
  "landing.safety.neverSold",
];

export function PrivacySection() {
  const { t } = useTranslation();

  return (
    <section id="privacy" className="border-b border-edge bg-surface-1 px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(500px,1.15fr)] lg:items-center lg:gap-20">
          <div>
            <p className="font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.2em] text-success">
              {t("landing.safety.kicker")}
            </p>
            <h2 className="mt-5 text-4xl font-black leading-[0.98] tracking-[-0.045em] text-strong sm:text-5xl lg:text-6xl">
              {t("landing.safety.title1")}
              <span className="mt-1 block text-accent">{t("landing.safety.title2")}</span>
            </h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-mid">
              {t("landing.safety.description")}
            </p>

            <div className="mt-9 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {ENGINECV_FEATURE_KEYS.map((key) => (
                <div key={key} className="flex items-start gap-3 border-t border-edge py-3 text-sm text-bright">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={2.5} aria-hidden="true" />
                  {t(key)}
                </div>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[1.1rem] border border-edge-strong bg-surface-0 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.22)] sm:p-7">
            <div className="flex items-center justify-between border-b border-edge pb-4">
              <span className="font-[family-name:var(--font-geist-mono)] text-[11px] uppercase tracking-[0.16em] text-faint">
                {t("landing.safety.routeLabel")}
              </span>
              <span className="inline-flex items-center gap-2 text-xs text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                {t("landing.safety.status")}
              </span>
            </div>

            <div className="grid gap-3 py-7 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center">
              <FlowNode icon={Monitor} label={t("landing.safety.browserNode")} detail={t("landing.safety.browserDetail")} />
              <ArrowRight className="mx-auto hidden h-4 w-4 text-faint sm:block" aria-hidden="true" />
              <FlowNode icon={HardDrive} label={t("landing.safety.deviceNode")} detail={t("landing.safety.deviceDetail")} />
              <ArrowRight className="mx-auto hidden h-4 w-4 text-faint sm:block" aria-hidden="true" />
              <FlowNode icon={Download} label={t("landing.safety.exportNode")} detail={t("landing.safety.exportDetail")} accent />
            </div>

            <div className="grid grid-cols-5 border border-edge bg-surface-1 font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider text-faint">
              {["PDF", "HTML", "PNG", "SVG", "JSON"].map((format) => (
                <span key={format} className="border-r border-edge px-2 py-3 text-center last:border-r-0">
                  {format}
                </span>
              ))}
            </div>

            <div className="mt-5 flex gap-3 border-l-2 border-accent bg-accent/5 py-2 pl-4 pr-3">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <p className="text-sm leading-6 text-mid">
                <span className="block font-semibold text-bright">{t("landing.safety.backupTitle")}</span>
                {t("landing.safety.backupWarning")}
              </p>
            </div>

            <Link
              href="/privacy"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-bright underline decoration-edge-strong underline-offset-4 transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {t("landing.safety.policyLink")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function FlowNode({
  icon: Icon,
  label,
  detail,
  accent = false,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className={`border p-4 ${accent ? "border-accent bg-accent/10" : "border-edge bg-surface-2"}`}>
      <Icon className={`h-5 w-5 ${accent ? "text-accent" : "text-mid"}`} aria-hidden="true" />
      <p className="mt-5 text-sm font-semibold text-strong">{label}</p>
      <p className={`mt-1 font-[family-name:var(--font-geist-mono)] text-[10px] uppercase tracking-wider ${accent ? "text-mid" : "text-faint"}`}>
        {detail}
      </p>
    </div>
  );
}
