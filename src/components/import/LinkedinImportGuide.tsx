"use client";

import { ExternalLink } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export const LINKEDIN_EXPORT_URL = "https://www.linkedin.com/mypreferences/d/download-my-data";

const STEPS = [
    { title: "linkedinImport.guideStep1Title", body: "linkedinImport.guideStep1Body", link: true },
    { title: "linkedinImport.guideStep2Title", body: "linkedinImport.guideStep2Body", link: false },
    { title: "linkedinImport.guideStep3Title", body: "linkedinImport.guideStep3Body", link: false },
    { title: "linkedinImport.guideStep4Title", body: "linkedinImport.guideStep4Body", link: false },
] as const;

export function LinkedinImportGuide() {
    const { t } = useTranslation();

    return (
        <div data-testid="linkedin-import-guide" className="space-y-3">
            <ol className="space-y-3">
                {STEPS.map((step, index) => (
                    <li
                        key={step.title}
                        className="rounded-xl border border-edge bg-surface-1 p-3.5"
                    >
                        <div className="flex items-start gap-3">
                            <span
                                aria-hidden="true"
                                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-edge text-xs font-semibold text-accent"
                            >
                                {index + 1}
                            </span>
                            <div className="min-w-0 space-y-1">
                                <p className="text-sm font-medium text-strong">{t(step.title)}</p>
                                <p className="text-xs leading-5 text-mid">{t(step.body)}</p>
                                {step.link && (
                                    <a
                                        href={LINKEDIN_EXPORT_URL}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        data-testid="linkedin-export-link"
                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-accent transition-colors hover:text-accent-soft"
                                    >
                                        {t("linkedinImport.guideStep1LinkLabel")}
                                        <ExternalLink className="h-3 w-3" />
                                    </a>
                                )}
                            </div>
                        </div>
                    </li>
                ))}
            </ol>
            <p data-testid="linkedin-own-data-note" className="text-xs leading-5 text-dim">
                {t("linkedinImport.ownDataNote")}
            </p>
        </div>
    );
}
