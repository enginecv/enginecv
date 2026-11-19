"use client";

import { FileText, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { LiveResumeThumbnail } from "@/components/dashboard/LiveResumeThumbnail";
import { useTranslation } from "@/lib/i18n";
import type { Resume } from "@/lib/schema";

export interface CvChoice {
    id: string;
    label: string;
    /** The CV itself, to draw its first page. Without it the card shows a plain page icon. */
    resume?: Resume;
    /** A second line under the title, such as the CV's headline. */
    detail?: string;
}

/**
 * Shows every CV as a card with a preview of its first page and lets the person choose one.
 * Built on native radio inputs, so arrow keys, focus and screen readers work without extra code.
 */
export function CvChoiceGrid({ choices, value, onChange, name, testIdPrefix }: {
    choices: CvChoice[];
    value: string;
    onChange: (id: string) => void;
    name: string;
    testIdPrefix: string;
}) {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");
    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return needle ? choices.filter((cv) => `${cv.label} ${cv.detail ?? ""}`.toLowerCase().includes(needle)) : choices;
    }, [choices, query]);

    return (
        <div className="mt-4 space-y-3">
            <label className="flex h-10 items-center gap-2 rounded-xl border border-edge bg-surface-4 px-3 text-sm text-mid focus-within:border-faint">
                <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("dashboard.letters.searchCvs")} aria-label={t("dashboard.letters.searchCvs")} data-testid={`${testIdPrefix}-search`} className="min-w-0 flex-1 bg-transparent text-strong placeholder:text-faint focus:outline-none" />
            </label>
            {visible.length === 0 ? (
                <p className="rounded-xl border border-dashed border-edge p-6 text-center text-sm text-faint" data-testid={`${testIdPrefix}-no-match`}>{t("dashboard.letters.noCvMatch", { query })}</p>
            ) : (
                <div role="radiogroup" aria-label={t("dashboard.letters.pickCv")} className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3" data-testid={`${testIdPrefix}-grid`}>
                    {visible.map((cv) => {
                        const selected = cv.id === value;
                        return (
                            <label key={cv.id} data-testid={`${testIdPrefix}-option-${cv.id}`} className={`group relative flex min-w-0 cursor-pointer flex-col gap-2 rounded-xl border p-2 transition-colors focus-within:ring-2 focus-within:ring-accent ${selected ? "border-accent bg-accent/10" : "border-edge bg-surface-1 hover:border-faint"}`}>
                                <input type="radio" name={name} value={cv.id} checked={selected} onChange={() => onChange(cv.id)} className="sr-only" />
                                <div className="pointer-events-none aspect-[210/297] w-full overflow-hidden rounded-lg border border-edge bg-white" aria-hidden="true">
                                    {cv.resume ? <LiveResumeThumbnail resume={cv.resume} /> : (
                                        <div className="flex h-full w-full items-center justify-center text-faint"><FileText className="h-8 w-8" /></div>
                                    )}
                                </div>
                                <span className="min-w-0 px-0.5">
                                    <span className="line-clamp-2 break-words text-sm font-semibold text-strong" title={cv.label}>{cv.label}</span>
                                    {cv.detail && <span className="block truncate text-xs text-mid">{cv.detail}</span>}
                                </span>
                            </label>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
