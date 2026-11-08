"use client";

import { useCallback, useId, useRef } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { StartOptions } from "@/components/dashboard/StartOptions";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { useTranslation } from "@/lib/i18n";
import { localizedPath } from "@/lib/i18n/locales";
import type { StartPathId } from "@/lib/onboarding/start-paths";
import { TOOLS_PATH } from "@/lib/tools/registry";

// e2e suites address the dialog's options by these ids.
const CREATE_MODAL_TEST_IDS: Partial<Record<StartPathId, string>> = {
    blank: "create-resume-from-scratch",
    example: "create-resume-from-example",
    ai: "create-resume-from-ai",
    linkedin: "create-resume-from-linkedin",
    europass: "create-resume-from-europass",
    github: "create-resume-from-github",
    json: "create-resume-import-json",
};

export function CreateModal({
    open,
    onClose,
    onSelect,
    onImportJson,
    focusId,
}: {
    open: boolean;
    onClose: () => void;
    /** Every start path except JSON, which this dialog handles with its own file input. */
    onSelect: (id: Exclude<StartPathId, "json">) => void;
    onImportJson: (file: File) => void;
    focusId?: StartPathId | null;
}) {
    const { t, locale } = useTranslation();
    const jsonInputRef = useRef<HTMLInputElement>(null);
    const titleId = useId();
    const dialogRef = useDialogFocus<HTMLDivElement>(open, onClose);

    const handleSelect = useCallback((id: StartPathId) => {
        if (id === "json") jsonInputRef.current?.click();
        else onSelect(id);
    }, [onSelect]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-4"
            onClick={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[1rem] border border-edge bg-surface-4 p-6 shadow-2xl sm:p-8"
            >
                <button type="button" onClick={onClose} aria-label={t("common.close")} className="absolute top-4 right-4 text-faint hover:text-strong transition-colors">
                    <X className="w-5 h-5" aria-hidden="true" />
                </button>

                <h2 id={titleId} className="text-xl font-semibold text-strong mb-2">{t("dashboard.createTitle")}</h2>
                <p className="text-faint text-sm mb-6">{t("dashboard.createSubtitle")}</p>

                <StartOptions
                    layout="stack"
                    testIdPrefix="create-resume"
                    testIds={CREATE_MODAL_TEST_IDS}
                    onSelect={handleSelect}
                    focusId={focusId}
                />

                <Link
                    href={localizedPath(TOOLS_PATH, locale)}
                    data-testid="create-resume-all-tools"
                    className="mt-3 block pt-1 text-center text-xs text-faint transition-colors hover:text-strong"
                >
                    {t("dashboard.allFreeTools")}
                </Link>

                <input
                    ref={jsonInputRef}
                    type="file"
                    accept=".json,application/json"
                    data-testid="create-resume-import-json-input"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onImportJson(file);
                        e.target.value = "";
                    }}
                />
            </div>
        </div>
    );
}
