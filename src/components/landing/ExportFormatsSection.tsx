"use client";

import { ExportFormatsDiagram } from "@/components/diagrams/ExportFormatsDiagram";
import { getExportFormatCount } from "@/lib/export-formats";
import { useTranslation } from "@/lib/i18n";

/** Every export format at a glance, built from the same registry as the export dialog. */
export function ExportFormatsSection() {
  const { t } = useTranslation();

  return (
    <section id="export-formats" className="border-b border-edge px-6 py-24 sm:py-32" data-testid="landing-export-map">
      <div className="mx-auto max-w-7xl">
        <h2 className="max-w-3xl text-4xl font-black leading-[0.98] tracking-[-0.045em] text-strong sm:text-5xl">
          {t("landing.exports.title", { count: getExportFormatCount() })}
        </h2>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-mid">{t("landing.exports.subtitle")}</p>
        <div className="mt-10">
          <ExportFormatsDiagram />
        </div>
      </div>
    </section>
  );
}
