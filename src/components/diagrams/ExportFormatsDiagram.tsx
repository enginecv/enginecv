"use client";

import { FileText, Lock, TriangleAlert } from "lucide-react";
import { EXPORT_FORMATS, type ResumeExportFormat } from "@/lib/export-formats";
import { useTranslation } from "@/lib/i18n";
import { Connector, DiagramFrame } from "./DiagramFrame";

type GroupId = "share" | "edit" | "keep";

/** Where each format goes. A test fails when a format is missing here, so the map cannot fall behind the registry. */
export const EXPORT_FORMAT_GROUPS: Record<GroupId, readonly ResumeExportFormat[]> = {
    share: ["pdf", "html"],
    edit: ["docx", "md", "txt", "tex"],
    keep: ["json", "jsonresume"],
};

const GROUP_ORDER: readonly GroupId[] = ["share", "edit", "keep"];

/** One CV, fanning out to every export format, grouped by what each is for. Built from the format registry. */
export function ExportFormatsDiagram() {
    const { t } = useTranslation();

    return (
        <DiagramFrame caption={t("diagram.export.caption")} testId="diagram-export-formats">
            <div className="grid gap-4 lg:grid-cols-[auto_auto_minmax(0,1fr)] lg:items-center">
                <div className="flex items-center justify-center gap-3 rounded-xl border border-accent/40 bg-accent/5 px-5 py-6 lg:flex-col lg:py-8" data-testid="diagram-export-source">
                    <FileText className="h-6 w-6 text-accent" aria-hidden="true" />
                    <span className="text-sm font-semibold text-strong">{t("diagram.export.cv")}</span>
                </div>

                <Connector />

                <div className="grid gap-3 md:grid-cols-3">
                    {GROUP_ORDER.map((group) => (
                        <section key={group} className="flex min-w-0 flex-col rounded-xl border border-edge bg-surface-2 p-3" data-testid={`diagram-export-group-${group}`}>
                            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">{t(`diagram.export.group.${group}`)}</h3>
                            <ul className="space-y-2">
                                {EXPORT_FORMAT_GROUPS[group].map((id) => {
                                    const format = EXPORT_FORMATS.find((entry) => entry.id === id);
                                    if (!format) return null;
                                    return (
                                        <li key={id} className="rounded-lg border border-edge bg-surface-1 px-3 py-2" data-testid={`diagram-export-${id}`}>
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                <span className="text-sm font-semibold text-strong">{t(format.labelKey)}</span>
                                                <code className="font-[family-name:var(--font-geist-mono)] text-[11px] text-mid">.{format.extension}</code>
                                            </div>
                                            <p className="mt-0.5 text-xs leading-5 text-mid">{t(format.descriptionKey)}</p>
                                            {(format.supportsEncryption || format.lossy) && (
                                                <p className="mt-1.5 flex flex-wrap gap-1.5">
                                                    {format.supportsEncryption && (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-edge px-2 py-0.5 text-[10px] font-medium text-mid">
                                                            <Lock className="h-3 w-3" aria-hidden="true" />
                                                            {t("diagram.export.tag.password")}
                                                        </span>
                                                    )}
                                                    {format.lossy && (
                                                        <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 px-2 py-0.5 text-[10px] font-medium text-warning">
                                                            <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                                                            {t("diagram.export.tag.contentOnly")}
                                                        </span>
                                                    )}
                                                </p>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>
        </DiagramFrame>
    );
}
