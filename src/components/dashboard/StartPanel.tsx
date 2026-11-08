"use client";

import { useCallback, useId, useRef } from "react";
import { StartOptions } from "@/components/dashboard/StartOptions";
import { useTranslation } from "@/lib/i18n";
import type { StartPathId } from "@/lib/onboarding/start-paths";

/** What an empty dashboard shows: every way to start a CV, in one screen. */
export function StartPanel({
    onSelect,
    onImportJson,
    focusId,
    pendingId,
    error,
}: {
    /** Every start path except JSON, which the panel handles with its own file input. */
    onSelect: (id: Exclude<StartPathId, "json">) => void;
    onImportJson: (file: File) => void;
    focusId?: StartPathId | null;
    pendingId?: StartPathId | null;
    error?: string | null;
}) {
    const { t } = useTranslation();
    const titleId = useId();
    const jsonInputRef = useRef<HTMLInputElement>(null);

    const handleSelect = useCallback((id: StartPathId) => {
        if (id === "json") jsonInputRef.current?.click();
        else onSelect(id);
    }, [onSelect]);

    return (
        <section aria-labelledby={titleId} data-testid="start-panel" className="mx-auto w-full max-w-4xl py-10 sm:py-14">
            <h2 id={titleId} className="text-2xl font-semibold text-strong">{t("onboarding.panel.title")}</h2>
            <p className="mt-2 mb-8 max-w-2xl text-sm text-faint">{t("onboarding.panel.intro")}</p>

            <StartOptions
                layout="grid"
                testIdPrefix="start-option"
                onSelect={handleSelect}
                focusId={focusId}
                pendingId={pendingId}
                disabled={Boolean(pendingId)}
            />

            {error && (
                <p role="alert" className="mt-4 text-sm text-danger-soft">{error}</p>
            )}

            <input
                ref={jsonInputRef}
                type="file"
                accept=".json,application/json"
                data-testid="start-panel-json-input"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImportJson(file);
                    e.target.value = "";
                }}
            />
        </section>
    );
}
