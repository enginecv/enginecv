"use client";

import { AlertTriangle, ChevronDown, Info } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { itemsOfKind, type ConversionReport, type LossItem } from "@/lib/json-resume/report";

/** Translation keys for the EngineCV section names a loss item can point at. */
const SECTION_LABEL_KEYS: Record<string, string> = {
    basics: "editor.personalDetails",
    experience: "editor.sectionExperience",
    organisations: "editor.sectionOrganisations",
    education: "editor.sectionEducation",
    awards: "editor.sectionAwards",
    certificates: "editor.sectionCertificates",
    publications: "editor.sectionPublications",
    projects: "editor.sectionProjects",
    references: "editor.sectionReferences",
    interests: "editor.sectionInterests",
    languages: "editor.sectionLanguages",
    skills: "editor.sectionSkills",
    courses: "editor.sectionCourses",
    declaration: "editor.sectionDeclaration",
    custom: "authoring.section.custom",
};

export interface ConversionLossSummaryProps {
    report: ConversionReport;
    /** Opens the item list straight away. */
    defaultOpen?: boolean;
    className?: string;
}

/**
 * What a conversion left out or changed. One component for import and export,
 * so every format reports loss the same way. Renders nothing for a clean conversion.
 */
export function ConversionLossSummary({ report, defaultOpen = false, className = "" }: ConversionLossSummaryProps) {
    const { t } = useTranslation();
    if (report.items.length === 0) return null;

    const groups = [
        { kind: "left-out" as const, titleKey: "conversion.group.leftOut", icon: <AlertTriangle className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" /> },
        { kind: "changed" as const, titleKey: "conversion.group.changed", icon: <Info className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" /> },
    ]
        .map((group) => ({ ...group, items: itemsOfKind(report, group.kind) }))
        .filter((group) => group.items.length > 0);

    const sectionLabel = (section: string) => {
        const key = SECTION_LABEL_KEYS[section];
        return key ? t(key) : t("conversion.section.general");
    };
    const message = (item: LossItem) =>
        t(`conversion.loss.${item.code}`, { section: sectionLabel(item.section), count: item.count ?? 0 });

    return (
        <section
            data-testid="conversion-loss-summary"
            aria-label={t("conversion.title")}
            className={`rounded-xl border border-edge bg-surface-1 p-4 text-sm ${className}`}
        >
            <p className="font-medium text-strong">{t("conversion.title")}</p>
            <details open={defaultOpen} className="group mt-2">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-faint hover:text-strong [&::-webkit-details-marker]:hidden">
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden="true" />
                    {t("conversion.showDetails")}
                </summary>
                <div className="mt-3 space-y-3">
                    {groups.map((group) => (
                        <div key={group.kind} data-testid={`conversion-group-${group.kind}`}>
                            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-mid">
                                {group.icon}
                                {t(group.titleKey)}
                            </p>
                            <ul className="mt-1.5 space-y-1 pl-5 text-xs leading-5 text-bright list-disc">
                                {group.items.map((item) => (
                                    <li key={`${item.code}:${item.section}`}>{message(item)}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </details>
        </section>
    );
}
