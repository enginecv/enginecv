"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { parseLinkedinArchive, type ParsedLinkedinArchive } from "@/lib/import/linkedin/archive";
import { LinkedinImportError, type LinkedinImportFailureClass } from "@/lib/import/linkedin/errors";
import { mapLinkedinToResume } from "@/lib/import/linkedin/map-linkedin-to-resume";
import type { RecognizedFile } from "@/lib/import/linkedin/zip";
import { persistImportedResume } from "@/lib/import/persist-imported-resume";
import type { Resume } from "@/lib/schema";
import { LinkedinArchiveDropZone } from "./LinkedinArchiveDropZone";
import { LinkedinImportGuide } from "./LinkedinImportGuide";

type PanelStep = "guide" | "parsing" | "preview" | "importing" | "error";

export interface LinkedinImportPanelProps {
    /** Called with the new resume id once it is saved. */
    onDone: (id: string) => void;
    /** Cancel on the preview. Without it the panel goes back to the drop zone. */
    onCancel?: () => void;
    /** Reports when saving is in progress, so a host dialog can block closing. */
    onBusyChange?: (busy: boolean) => void;
    /** Id of the element that names the panel, when it stands on a page. */
    labelledBy?: string;
    persistResume?: (resume: Resume) => Promise<string>;
}

const ERROR_MESSAGE_KEYS: Record<LinkedinImportFailureClass, string> = {
    "too-large": "linkedinImport.errorTooLarge",
    "unrecognized-file": "linkedinImport.errorUnrecognizedFile",
    "corrupt-archive": "linkedinImport.errorCorruptArchive",
    "no-profile-data": "linkedinImport.errorNoProfileData",
};

const SECTION_LABEL_KEYS: Record<Exclude<RecognizedFile, "profile">, string> = {
    positions: "linkedinImport.previewSectionExperience",
    education: "linkedinImport.previewSectionEducation",
    skills: "linkedinImport.previewSectionSkills",
    certifications: "linkedinImport.previewSectionCertifications",
    languages: "linkedinImport.previewSectionLanguages",
    projects: "linkedinImport.previewSectionProjects",
};

function sectionCount(parsed: ParsedLinkedinArchive, section: Exclude<RecognizedFile, "profile">): number {
    return parsed[section].length;
}

/** The LinkedIn export import flow: guide and drop zone, preview, save. Used by the dialog and the tool page. */
export function LinkedinImportPanel({
    onDone,
    onCancel,
    onBusyChange,
    labelledBy,
    persistResume = persistImportedResume,
}: LinkedinImportPanelProps) {
    const { t, tn } = useTranslation();

    const [step, setStep] = useState<PanelStep>("guide");
    const [parsed, setParsed] = useState<ParsedLinkedinArchive | null>(null);
    const [failureClass, setFailureClass] = useState<LinkedinImportFailureClass | null>(null);
    const [sessionId, setSessionId] = useState(0);

    const reset = useCallback(() => {
        setSessionId((current) => current + 1);
        setStep("guide");
        setParsed(null);
        setFailureClass(null);
    }, []);

    const showFailure = useCallback((cls: LinkedinImportFailureClass) => {
        setParsed(null);
        setFailureClass(cls);
        setStep("error");
    }, []);

    const handleFiles = useCallback(
        async (files: File[]) => {
            const session = sessionId;
            setStep("parsing");
            try {
                const result = await parseLinkedinArchive(files);
                // A reset (or unmount) mid-parse bumps the session; drop stale results.
                setSessionId((current) => {
                    if (current === session) {
                        setParsed(result);
                        setFailureClass(null);
                        setStep("preview");
                    }
                    return current;
                });
            } catch (error) {
                setSessionId((current) => {
                    if (current === session) {
                        showFailure(
                            error instanceof LinkedinImportError ? error.failureClass : "corrupt-archive",
                        );
                    }
                    return current;
                });
            }
        },
        [sessionId, showFailure],
    );

    const confirmImport = useCallback(async () => {
        if (!parsed) return;
        setStep("importing");
        try {
            const mapped = mapLinkedinToResume(parsed);
            const id = await persistResume(mapped);
            onDone(id);
        } catch {
            showFailure("corrupt-archive");
        }
    }, [onDone, parsed, persistResume, showFailure]);

    useEffect(() => {
        onBusyChange?.(step === "importing");
    }, [onBusyChange, step]);

    const cancel = onCancel ?? reset;
    const missingSections = parsed
        ? parsed.filesMissing
              .filter((file): file is Exclude<RecognizedFile, "profile"> => file !== "profile")
              .map((file) => t(SECTION_LABEL_KEYS[file]))
        : [];
    const skippedTotal = parsed
        ? Object.values(parsed.skippedRows).reduce((sum, count) => sum + (count ?? 0), 0)
        : 0;

    return (
        <div aria-labelledby={labelledBy} role={labelledBy ? "region" : undefined} data-testid="linkedin-import-panel">
            {step === "guide" && (
                <div className="space-y-4">
                    <LinkedinImportGuide />
                    <LinkedinArchiveDropZone
                        onFiles={(files) => void handleFiles(files)}
                        onTooLarge={() => showFailure("too-large")}
                    />
                </div>
            )}

            {(step === "parsing" || step === "importing") && (
                <div className="flex min-h-40 items-center justify-center rounded-xl border border-edge bg-surface-1 p-8 text-center">
                    <div>
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent" />
                        <p className="mt-4 text-sm text-bright">
                            {step === "importing"
                                ? t("linkedinImport.importing")
                                : t("linkedinImport.parsing")}
                        </p>
                    </div>
                </div>
            )}

            {step === "preview" && parsed && (
                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold text-strong">
                            {t("linkedinImport.previewTitle")}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-dim">
                            {t("linkedinImport.previewSubtitle")}
                        </p>
                    </div>

                    {parsed.profile ? (
                        <div
                            data-testid="linkedin-preview-profile"
                            className="rounded-xl border border-edge bg-surface-1 p-3.5"
                        >
                            <p className="text-sm font-semibold text-strong">
                                {[parsed.profile.firstName, parsed.profile.lastName]
                                    .filter(Boolean)
                                    .join(" ")}
                            </p>
                            {parsed.profile.headline && (
                                <p className="mt-0.5 text-xs text-mid">{parsed.profile.headline}</p>
                            )}
                        </div>
                    ) : (
                        <p
                            data-testid="linkedin-preview-empty-profile"
                            className="rounded-lg border border-warning-tint2 bg-warning-tint px-3 py-2 text-xs leading-5 text-warning"
                        >
                            {t("linkedinImport.previewEmptyProfile")}
                        </p>
                    )}

                    <ul data-testid="linkedin-preview-sections" className="grid gap-2 sm:grid-cols-2">
                        {(Object.keys(SECTION_LABEL_KEYS) as Array<Exclude<RecognizedFile, "profile">>)
                            .filter((section) => sectionCount(parsed, section) > 0)
                            .map((section) => (
                                <li
                                    key={section}
                                    data-testid={`linkedin-preview-section-${section}`}
                                    className="flex items-center justify-between rounded-xl border border-edge bg-surface-1 px-3.5 py-2.5"
                                >
                                    <span className="text-sm text-strong">{t(SECTION_LABEL_KEYS[section])}</span>
                                    <span className="text-xs text-dim">
                                        {tn("linkedinImport.previewEntryCount", sectionCount(parsed, section))}
                                    </span>
                                </li>
                            ))}
                    </ul>

                    {missingSections.length > 0 && (
                        <p
                            data-testid="linkedin-preview-missing"
                            className="text-xs leading-5 text-dim"
                        >
                            {t("linkedinImport.previewMissing", { sections: missingSections.join(", ") })}
                        </p>
                    )}
                    {skippedTotal > 0 && (
                        <p
                            data-testid="linkedin-preview-skipped"
                            className="rounded-lg border border-warning-tint2 bg-warning-tint px-3 py-2 text-xs leading-5 text-warning"
                        >
                            {tn("linkedinImport.previewSkippedRows", skippedTotal)}
                        </p>
                    )}
                    {parsed.ignoredInputs.length > 0 && (
                        <p
                            data-testid="linkedin-preview-ignored"
                            className="text-xs leading-5 text-dim"
                        >
                            {t("linkedinImport.previewIgnoredInputs", {
                                names: parsed.ignoredInputs.join(", "),
                            })}
                        </p>
                    )}

                    <div className="flex flex-wrap justify-end gap-3">
                        <button
                            type="button"
                            onClick={cancel}
                            data-testid="linkedin-import-cancel"
                            className="rounded-xl border border-edge px-4 py-2.5 text-sm font-medium text-bright transition-colors hover:border-faint hover:text-strong"
                        >
                            {t("linkedinImport.cancel")}
                        </button>
                        <button
                            type="button"
                            onClick={() => void confirmImport()}
                            data-testid="linkedin-import-confirm"
                            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-surface-2 transition-colors hover:bg-accent-soft"
                        >
                            {t("linkedinImport.confirm")}
                        </button>
                    </div>
                </div>
            )}

            {step === "error" && failureClass && (
                <div className="space-y-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                    <p data-testid="linkedin-import-error" className="text-sm leading-6 text-danger-soft">
                        {t(ERROR_MESSAGE_KEYS[failureClass])}
                    </p>
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={reset}
                            data-testid="linkedin-import-retry"
                            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-surface-2 transition-colors hover:bg-accent-soft"
                        >
                            {t("linkedinImport.retry")}
                        </button>
                    </div>
                </div>
            )}

            <p
                data-testid="linkedin-trademark-disclaimer"
                className="mt-5 border-t border-edge pt-3 text-[11px] leading-4 text-faint"
            >
                {t("linkedinImport.trademarkDisclaimer")}
            </p>
        </div>
    );
}
