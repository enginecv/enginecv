"use client";

import { X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { getImportSource, type SourceId } from "@/lib/import/sources";
import { countBatchEntries } from "@/lib/import/staging/plan";
import type { StagedBatch } from "@/lib/import/staging/types";
import { AuthoringImportSummary } from "../AuthoringImportSummary";
import { ConversionLossSummary } from "../ConversionLossSummary";

interface StagedSourcesProps {
    batches: StagedBatch[];
    onRemove: (id: string) => void;
}

function sourceLabelKey(id: string): string | null {
    try {
        return getImportSource(id as SourceId).labelKey;
    } catch {
        return null;
    }
}

/** The sources added so far, each with what it holds and what it could not carry. */
export function StagedSources({ batches, onRemove }: StagedSourcesProps) {
    const { t, tn } = useTranslation();
    if (batches.length === 0) return null;

    return (
        <section aria-label={t("importHub.staged")} data-testid="import-hub-staged" className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-faint">{t("importHub.staged")}</h3>
            <ul className="space-y-2">
                {batches.map((batch) => {
                    const labelKey = sourceLabelKey(batch.sourceId);
                    return (
                        <li key={batch.id} className="rounded-lg border border-edge p-3" data-testid="import-hub-batch">
                            <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm text-bright">{batch.label}</p>
                                    <p className="text-xs text-faint">
                                        {labelKey ? `${t(labelKey)} · ` : ""}
                                        {tn("importHub.entries", countBatchEntries(batch))}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onRemove(batch.id)}
                                    aria-label={t("importHub.remove", { name: batch.label })}
                                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-faint outline-none transition-colors hover:text-strong focus-visible:ring-1 focus-visible:ring-accent"
                                >
                                    <X className="h-4 w-4" aria-hidden="true" />
                                </button>
                            </div>
                            {batch.authoring
                                ? <div className="mt-2"><AuthoringImportSummary result={batch.authoring.result} parseNotices={batch.authoring.parseNotices} /></div>
                                : batch.losses && <ConversionLossSummary report={batch.losses} className="mt-2" />}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
