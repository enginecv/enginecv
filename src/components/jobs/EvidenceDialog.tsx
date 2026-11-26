"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { LiveResumeThumbnail } from "@/components/dashboard/LiveResumeThumbnail";
import { LetterPreview } from "@/components/letters/LetterPreview";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";
import type { CapturedDocuments } from "@/lib/jobs/submissions";
import { resolveLetter } from "@/lib/letters/resolve";

/**
 * The frozen copies recorded with one submission, rendered from the copy alone (never from the live
 * documents). A later version of the renderer may lay them out a little differently; the content and
 * settings are the ones captured.
 */
export function EvidenceDialog({ documents, onClose }: { documents: CapturedDocuments; onClose: () => void }) {
    const { t, locale } = useTranslation();
    const ref = useDialogFocus<HTMLDivElement>(true, onClose);
    const tabs = [documents.cv ? "cv" : null, documents.letter ? "letter" : null].filter((tab): tab is "cv" | "letter" => tab !== null);
    const [tab, setTab] = useState(tabs[0]);
    const resolvedLetter = useMemo(() => (documents.letter ? resolveLetter(documents.letter.letter, null) : null), [documents.letter]);
    const captured = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(documents.capturedAt);
    const title = tab === "cv" ? documents.cv?.title : documents.letter?.title;

    return (
        <div className="fixed inset-0 z-[230] flex items-stretch justify-center sm:p-4">
            <div className="absolute inset-0 bg-surface-2/80 backdrop-blur-md" onClick={onClose} />
            <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="evidence-title" className="relative flex h-full w-full max-w-4xl flex-col overflow-hidden bg-surface-1 shadow-2xl sm:rounded-2xl" data-testid="evidence-dialog">
                <header className="flex items-start gap-3 border-b border-edge px-5 py-4">
                    <div className="min-w-0 flex-1">
                        <h2 id="evidence-title" className="break-words text-lg font-bold text-strong">{title || t("dashboard.untitled")}</h2>
                        <p className="text-xs text-faint">{t("jobs.evidence.captured", { date: captured })}</p>
                    </div>
                    {tabs.length > 1 && (
                        <div role="tablist" aria-label={t("jobs.evidence.title")} className="flex gap-1">
                            {tabs.map((id) => (
                                <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} data-testid={`evidence-tab-${id}`} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === id ? "bg-surface-4 text-strong" : "text-mid hover:text-strong"}`}>
                                    {t(id === "cv" ? "jobs.record.cv" : "jobs.record.letter")}
                                </button>
                            ))}
                        </div>
                    )}
                    <button type="button" onClick={onClose} aria-label={t("common.close")} className="rounded-lg p-2 text-faint hover:text-strong"><X className="h-5 w-5" aria-hidden="true" /></button>
                </header>
                <p className="border-b border-edge bg-surface-2 px-5 py-2 text-xs text-mid">{t("jobs.evidence.note")}</p>
                <div className="min-h-0 flex-1 overflow-y-auto bg-surface-0 p-4 sm:p-6" data-testid={`evidence-${tab}`}>
                    {tab === "cv" && documents.cv && (
                        <div className="mx-auto max-w-[794px] overflow-hidden rounded-lg shadow-xl">
                            <LiveResumeThumbnail resume={documents.cv.resume} />
                        </div>
                    )}
                    {tab === "letter" && resolvedLetter && <LetterPreview letter={resolvedLetter} />}
                </div>
            </div>
        </div>
    );
}
